# Deployment guide (not executed)

## Prerequisites
1. Secure AWS root with MFA; deploy using IAM Identity Center or federated role, not long-lived user keys.
2. Enable AWS Budgets/billing alerts and select region (`eu-central-1` default).
3. Install AWS CLI v2, Node 24, Java 25/Maven, Python 3.14, Docker/Podman and CDK CLI.
4. Configure profile and verify `aws sts get-caller-identity`.

## Bootstrap
```bash
cd infrastructure
npm install
npm run build
npx cdk bootstrap aws://ACCOUNT_ID/eu-central-1 --profile photo-app-dev
```
Bootstrap creates support resources and may incur storage charges.

## Deployment order
1. Review and synthesize all CDK stacks; deploy private S3, DynamoDB and Cognito. The CDK app declares cross-stack dependencies.
2. Deploy SQS/DLQ and Lambda; the originals bucket notification is filtered to `originals/` to avoid recursive events.
3. Build/push the API image to the generated ECR repository, then update ECS desired count from zero and deploy ECS Fargate + ALB. The starter service intentionally starts with zero tasks to avoid idle compute charges.
4. Copy `frontend/.env.example` to `.env.local`; set `VITE_AWS_REGION`, `VITE_COGNITO_USER_POOL_ID` and `VITE_COGNITO_USER_POOL_CLIENT_ID` from the `PhotoIdentity` stack outputs. Keep `VITE_API_BASE_URL=/api/v1` when using the CloudFront distribution. Build React, upload the build to the private frontend bucket and invalidate CloudFront.
5. For CloudFront custom domain, ACM certificate must be in `us-east-1`; validate DNS. ALB certificate is regional.
6. Test sign-in, upload intent, S3 PUT, confirmation, SQS/Lambda processing, gallery, image authorization, share expiry and revocation.
7. Add alarms, log retention, budgets, rate controls/WAF and backup/retention policies.

## Build commands
```bash
cd backend && mvn clean package && docker build -t photo-sharing-api:local .
cd ../frontend && npm install && npm run build
cd ../lambdas/thumbnail-generator && pip install -r requirements-dev.txt && python -m pytest
cd ../../infrastructure && npm install && npm run build && npx cdk synth
```
Inspect `cdk diff` and synthesized templates before deployment. Confirm replacements/deletions and S3 retention. ALB and CloudFront have ongoing costs; deleting a stack may leave retained data or other resources.
