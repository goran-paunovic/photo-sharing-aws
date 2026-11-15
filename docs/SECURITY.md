# Security checklist

- Validate Cognito **access tokens** (signature, issuer, expiry and `token_use=access`); do not use ID tokens as API bearer tokens.
- Use JWT `sub` as owner identity; enforce ownership on every photo/share operation.
- Keep S3 Block Public Access enabled; use OAC bucket policies for CloudFront. The originals bucket currently allows wildcard CORS origins for presigned PUT requests; restrict this to the deployed frontend origin before production.
- Presigned upload URLs: five-minute expiry, server-generated key, signed content type, and a 20 MiB size limit checked at intent and completion. The current implementation verifies S3 object length and declared content type; the image Lambda performs actual decoding. Add checksum signing and stronger content sniffing before production.
- Verify actual bytes, decoded format and pixel dimensions. Do not trust file extension or browser MIME. Limit decompression/pixel bombs; reject SVG/HTML on trusted image origin.
- Lambda must be idempotent; configure SQS partial batch failure reporting and DLQ.
- ECS task execution role is for image pull/logging; ECS task role is for app access. Lambda role reads only originals, writes only processed prefixes and updates only its table.
- CloudFront OAC is origin authorization, not viewer authorization. Use signed URLs/cookies or an authorization proxy for private photos.
- Do not cache authenticated API responses. Never log bearer tokens, presigned URLs or share secrets.
- Keep private signing keys in Secrets Manager; never in Git or Vite variables.
- Configure TLS, rate limiting, log retention, budgets and alarms before production.
