package com.example.photos.photo;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@RestController
@RequestMapping("/api/v1/photos")
public class PhotoController {
    private static final long MAX_UPLOAD_BYTES = 20L * 1024 * 1024;
    private static final Map<String, String> EXTENSIONS = Map.of(
        "image/jpeg", "jpg", "image/png", "png", "image/webp", "webp");

    private final S3Client s3;
    private final S3Presigner presigner;
    private final DynamoDbClient dynamoDb;
    private final String originalsBucket;
    private final String processedBucket;
    private final String photosTable;

    public PhotoController(S3Client s3, S3Presigner presigner, DynamoDbClient dynamoDb,
            @Value("${app.aws.originals-bucket}") String originalsBucket,
            @Value("${app.aws.processed-bucket}") String processedBucket,
            @Value("${app.aws.photos-table}") String photosTable) {
        this.s3 = s3;
        this.presigner = presigner;
        this.dynamoDb = dynamoDb;
        this.originalsBucket = originalsBucket;
        this.processedBucket = processedBucket;
        this.photosTable = photosTable;
    }

    @PostMapping("/upload-url")
    public UploadIntentResponse createUploadIntent(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateUploadIntentRequest request) {
        String extension = EXTENSIONS.get(request.contentType());
        if (extension == null) throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only JPEG, PNG and WebP are accepted");
        if (request.sizeBytes() > MAX_UPLOAD_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Maximum file size is 20 MiB");

        String userId = requireUserId(jwt);
        String photoId = UUID.randomUUID().toString();
        String objectKey = "originals/" + userId + "/" + photoId + "." + extension;
        Instant now = Instant.now();
        String createdAt = now.toString();
        String safeFileName = request.fileName().replaceAll("[\\r\\n\\\\/]+", "_");

        // Persist the item before issuing a URL: the S3 event can arrive immediately after PUT.
        dynamoDb.putItem(PutItemRequest.builder().tableName(photosTable).item(Map.of(
            "photoId", s(photoId), "userId", s(userId), "fileName", s(safeFileName),
            "contentType", s(request.contentType()), "sizeBytes", n(request.sizeBytes()),
            "originalKey", s(objectKey), "processingStatus", s("PENDING"),
            "createdAt", s(createdAt), "createdAtPhotoId", s(createdAt + "#" + photoId)
        )).build());

        PutObjectRequest put = PutObjectRequest.builder().bucket(originalsBucket).key(objectKey)
            .contentType(request.contentType()).build();
        PresignedPutObjectRequest signed = presigner.presignPutObject(PutObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(5)).putObjectRequest(put).build());
        return new UploadIntentResponse(photoId, objectKey, signed.url().toString(), createdAt,
            Map.of("Content-Type", request.contentType()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmUpload(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ConfirmUploadRequest request) {
        String userId = requireUserId(jwt);
        Map<String, AttributeValue> item = getOwnedPhoto(userId, request.photoId());
        if (item == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found");
        String key = item.get("originalKey").s();
        try {
            var head = s3.headObject(HeadObjectRequest.builder().bucket(originalsBucket).key(key).build());
            if (head.contentLength() == null || head.contentLength() <= 0 || head.contentLength() > MAX_UPLOAD_BYTES)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded object has an invalid size");
            String expectedType = item.get("contentType").s();
            if (!expectedType.equals(head.contentType())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded content type does not match the upload intent");
            dynamoDb.updateItem(UpdateItemRequest.builder().tableName(photosTable)
                .key(Map.of("photoId", s(request.photoId())))
                .updateExpression("SET uploadedAt = :uploadedAt, sizeBytes = :sizeBytes")
                .conditionExpression("userId = :userId AND attribute_exists(originalKey)")
                .expressionAttributeValues(Map.of(":uploadedAt", s(Instant.now().toString()),
                    ":sizeBytes", n(head.contentLength()), ":userId", s(userId))).build());
        } catch (ResponseStatusException e) { throw e; }
        catch (SdkException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not verify uploaded object", e); }
    }

    @GetMapping
    public PhotoPage listPhotos(@AuthenticationPrincipal Jwt jwt, @RequestParam(defaultValue = "24") @Positive int limit) {
        String userId = requireUserId(jwt);
        int boundedLimit = Math.min(limit, 100);
        var result = dynamoDb.query(QueryRequest.builder().tableName(photosTable)
            .indexName("ByOwnerAndCreatedAt")
            .keyConditionExpression("userId = :userId")
            .expressionAttributeValues(Map.of(":userId", s(userId)))
            .scanIndexForward(false).limit(boundedLimit).build());
        List<PhotoItem> photos = new ArrayList<>();
        for (Map<String, AttributeValue> item : result.items()) {
            String thumbnailUrl = null;
            AttributeValue thumbnailKey = item.get("thumbnailKey");
            if (thumbnailKey != null) {
                var get = software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
                    .bucket(processedBucket).key(thumbnailKey.s()).build();
                PresignedGetObjectRequest signed = presigner.presignGetObject(GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(10)).getObjectRequest(get).build());
                thumbnailUrl = signed.url().toString();
            }
            photos.add(new PhotoItem(value(item, "photoId"), value(item, "fileName"),
                value(item, "processingStatus"), value(item, "createdAt"), thumbnailUrl));
        }
        return new PhotoPage(photos, null);
    }

    private Map<String, AttributeValue> getOwnedPhoto(String userId, String photoId) {
        var result = dynamoDb.getItem(r -> r.tableName(photosTable).key(Map.of("photoId", s(photoId))).consistentRead(true));
        Map<String, AttributeValue> item = result.item();
        return item != null && !item.isEmpty() && userId.equals(value(item, "userId")) ? item : null;
    }

    private static String requireUserId(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return jwt.getSubject();
    }
    private static AttributeValue s(String value) { return AttributeValue.builder().s(value).build(); }
    private static AttributeValue n(long value) { return AttributeValue.builder().n(Long.toString(value)).build(); }
    private static String value(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key); return value == null ? null : value.s();
    }

    public record CreateUploadIntentRequest(@NotBlank @Size(max = 255) String fileName,
        @NotBlank String contentType, @Positive long sizeBytes) {}
    public record UploadIntentResponse(String photoId, String objectKey, String uploadUrl,
        String createdAt, Map<String, String> headers) {}
    public record ConfirmUploadRequest(@NotBlank String photoId) {}
    public record PhotoItem(String photoId, String fileName, String processingStatus,
        String createdAt, String thumbnailUrl) {}
    public record PhotoPage(List<PhotoItem> items, String nextCursor) {}
}
