# Photo Sharing App — AWS starter

Portfolio-oriented starter using React + TypeScript + Vite + Ant Design; Spring Boot 4.1.2 / Java 25; Python 3.14 Lambda; AWS CDK v2; Cognito; private S3; DynamoDB; SQS + DLQ; ECS Fargate / ALB; CloudFront OAC.

> This is an implementation-stage starter, not a production-ready service. Cognito sign-up/sign-in, protected routes, authenticated API calls, S3 presigned uploads, DynamoDB upload intents, upload verification and owner-scoped gallery listing are implemented. Sharing, deletion, cursor pagination, signed CloudFront viewer delivery, production hardening and end-to-end tests remain. No AWS resources have been deployed. See `docs/IMPLEMENTATION-STATUS.md`.

## Layout
- `frontend/` React SPA
- `backend/` Spring Boot API and Dockerfile
- `lambdas/thumbnail-generator/` Python image processing
- `infrastructure/` AWS CDK TypeScript stacks
- `docs/` architecture, security, local development, deployment and cost notes

## Prerequisites
Java 25 JDK, Maven 3.9+, Node.js 24 LTS, Python 3.14, Docker or Podman, AWS CLI v2 and AWS CDK v2. Versions were checked 2026-11-14; re-check official references before deployment (see `docs/REFERENCES.md`).

## Local quick start

Frontend:
```bash
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

Backend (health endpoint works locally):
```bash
cd backend && mvn test && mvn spring-boot:run -Dspring-boot.run.profiles=local
```
`local` disables the HTTP security filter for local health checks only; photo endpoints still require a JWT principal and AWS resources. Never deploy with that profile.

Lambda unit tests:
```bash
cd lambdas/thumbnail-generator
python -m venv .venv
# Windows: .venv\Scripts\activate; macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt && python -m pytest
```

CDK synthesis only:
```bash
cd infrastructure && npm install && npm run build && npx cdk synth
```
Synthesis is local. No `cdk deploy` is run by this starter.

## Security defaults
S3 buckets block public access, enforce TLS and use encryption. CloudFront uses OAC for S3 origins. Cognito JWT validation is enabled outside the local profile. ECS task and execution roles must remain separate. Never commit credentials or put privileged AWS secrets in Vite variables. OAC protects the S3 origin; it does not authorize individual viewers. Use CloudFront signed URLs/cookies or an authorization proxy for private images. API responses containing user data must not be cached in a shared CloudFront cache.

## Implemented upload milestone
The browser authenticates with Cognito, requests an upload intent, uploads directly to private S3 with a short-lived presigned URL, confirms the object, and queries the owner-scoped gallery. The S3 event triggers the thumbnail Lambda, which updates the existing DynamoDB record. See `docs/IMPLEMENTATION-STATUS.md` for the remaining production work.

## Continuous integration

The public repository uses GitHub Actions (`.github/workflows/ci.yml`) to validate the frontend, Spring Boot backend, Python thumbnail Lambda, and CDK infrastructure on pull requests and pushes to `main`.

Before the first push, generate and commit the npm lockfiles:

```powershell
cd frontend
npm install
cd ..\infrastructure
npm install
```

Commit both `frontend/package-lock.json` and `infrastructure/package-lock.json`. CI uses `npm ci` so dependency installation is reproducible. The workflow does not need AWS credentials and does not deploy resources.

Dependabot is configured for npm, Maven, pip, and GitHub Actions updates. See `SECURITY.md` before reporting a vulnerability. Choose and add an explicit open-source license before inviting reuse; a public GitHub repository without a license does not grant general permission to reuse its code.

## GitHub Actions scope

The initial CI workflow is deliberately read-only (`contents: read`). AWS deployment workflows and OIDC roles will be added only after the build is green and the target AWS account/region are confirmed.
