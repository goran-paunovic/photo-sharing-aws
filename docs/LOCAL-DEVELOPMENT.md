# Local development

Run React and Spring Boot locally. Use a real Cognito development User Pool for authentication integration tests. S3/SQS/DynamoDB emulators are useful but not identical to AWS; keep disposable AWS integration tests before production.

## Frontend
```bash
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

## Backend
```bash
cd backend && mvn test && mvn spring-boot:run -Dspring-boot.run.profiles=local
```

## Lambda
```bash
cd lambdas/thumbnail-generator
python -m venv .venv
pip install -r requirements-dev.txt
pytest
```

Package Pillow for the Lambda runtime/architecture. Build in a Lambda Python 3.14-compatible container or use a Lambda container image for native binary compatibility.

## CDK
```bash
cd infrastructure && npm install && npm run build && npx cdk synth
```
Never deploy until account, region, charges, IAM changes and cleanup plan are reviewed.
