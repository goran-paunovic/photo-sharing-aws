# Implementation status

| Area | Included | Remaining |
|---|---|---|
| React | Vite, TypeScript, Ant Design, Cognito sign-up/sign-in/email confirmation/sign-out, protected app routes, authenticated API client, gallery query, direct-to-S3 upload flow | UI tests, upload progress/retry, pagination, image detail and delete |
| Spring API | Boot app, Cognito access-token validation, S3 presigned PUT, DynamoDB upload-intent persistence, upload verification, owner-scoped gallery query, presigned thumbnail GET | Share creation/resolution, delete, cursor pagination, integration tests and structured error responses |
| Lambda | Pillow WebP generation, SQS partial-batch handler, deterministic S3 output keys, conditional DynamoDB completion update, unit test | DLQ failure workflow, stricter decoded-format verification, integration tests |
| CDK | Private S3 with upload CORS, DynamoDB, Cognito issuer wiring, SQS/DLQ, Lambda, ECS/ALB, CloudFront S3 OAC and API behavior | CloudFront signed image delivery, ALB origin hardening, private networking, autoscaling, alarms and CI/CD |

## Upload sequence

1. The authenticated browser requests `POST /api/v1/photos/upload-url` with filename, MIME type and byte size.
2. The API validates the request, derives the owner from the verified Cognito JWT `sub`, writes a `PENDING` DynamoDB item, and returns a five-minute presigned S3 PUT URL.
3. The browser PUTs the bytes directly to the private originals bucket with the signed `Content-Type` header.
4. The browser calls `POST /api/v1/photos`; the API performs `HeadObject` verification and records upload metadata.
5. The S3 event feeds SQS; the Python Lambda creates WebP renditions and marks the item `COMPLETED`.
6. The gallery API queries only the authenticated user's GSI partition and returns a ten-minute presigned thumbnail URL when processing has completed.

The upload intent is persisted before the presigned URL is returned so an early S3 event cannot race ahead of the DynamoDB record. A failed upload can leave a `PENDING` record; add a scheduled cleanup process before production.

No AWS resources were deployed. Live AWS permissions, quotas, Cognito behavior, S3 notifications, CDK deploy and billing are not verified. Build and integration checks must be run with the pinned toolchains on a machine with AWS credentials.
