"""SQS-triggered S3 image processor for originals/{userId}/{photoId}.{ext}."""
import json
import logging
import os
from io import BytesIO
from urllib.parse import unquote_plus
from typing import Any

import boto3
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger()
logger.setLevel(logging.INFO)
s3 = None
dynamodb = None

def aws_clients():
    global s3, dynamodb
    if s3 is None:
        region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
        s3 = boto3.client("s3", region_name=region)
        dynamodb = boto3.resource("dynamodb", region_name=region)
    return s3, dynamodb

MAX_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "40000000"))


def make_webp(image_bytes: bytes, bounds: tuple[int, int], quality: int = 82) -> bytes:
    """Decode, normalize EXIF orientation, resize and encode a bounded WebP rendition."""
    try:
        with Image.open(BytesIO(image_bytes)) as source:
            if source.width * source.height > MAX_PIXELS:
                raise ValueError("Image exceeds configured pixel limit")
            image = ImageOps.exif_transpose(source)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")
            image.thumbnail(bounds, Image.Resampling.LANCZOS)
            output = BytesIO()
            image.save(output, format="WEBP", quality=quality, method=6)
            return output.getvalue()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Unsupported or corrupted image") from exc


def process_s3_object(bucket: str, key: str) -> None:
    """Create deterministic renditions and update the pre-created photo item."""
    parts = key.split("/")
    if len(parts) != 3 or parts[0] != "originals":
        raise ValueError("Expected object key originals/{userId}/{photoId}.{extension}")
    user_id = parts[1]
    filename = parts[2]
    photo_id = filename.rsplit(".", 1)[0]
    if not user_id or not photo_id:
        raise ValueError("Invalid original object key")

    s3_client, dynamodb_resource = aws_clients()
    body = s3_client.get_object(Bucket=bucket, Key=key)["Body"].read()
    thumbnail = make_webp(body, (240, 240))
    medium = make_webp(body, (1600, 1600))
    processed_bucket = os.environ["PROCESSED_BUCKET"]
    thumbnail_key = f"thumbnails/{user_id}/{photo_id}.webp"
    medium_key = f"medium/{user_id}/{photo_id}.webp"

    # Deterministic keys make retries idempotent: a duplicate event overwrites same outputs.
    s3_client.put_object(Bucket=processed_bucket, Key=thumbnail_key, Body=thumbnail,
                  ContentType="image/webp", CacheControl="private, max-age=300")
    s3_client.put_object(Bucket=processed_bucket, Key=medium_key, Body=medium,
                  ContentType="image/webp", CacheControl="private, max-age=300")

    table = dynamodb_resource.Table(os.environ["PHOTOS_TABLE"])
    table.update_item(
        Key={"photoId": photo_id},
        UpdateExpression="SET thumbnailKey = :thumb, mediumKey = :medium, processingStatus = :status",
        ConditionExpression="attribute_exists(photoId)",
        ExpressionAttributeValues={":thumb": thumbnail_key, ":medium": medium_key, ":status": "COMPLETED"},
    )
    logger.info("Processed photoId=%s to s3://%s", photo_id, processed_bucket)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process SQS records with partial batch failure reporting."""
    failures = []
    for record in event.get("Records", []):
        message_id = record.get("messageId", "unknown")
        try:
            payload = json.loads(record["body"])
            for item in payload.get("Records", []):
                if item.get("eventSource") != "aws:s3":
                    continue
                bucket = item["s3"]["bucket"]["name"]
                key = unquote_plus(item["s3"]["object"]["key"])
                process_s3_object(bucket, key)
        except Exception:
            logger.exception("Failed processing SQS message %s", message_id)
            failures.append({"itemIdentifier": message_id})
    return {"batchItemFailures": failures}
