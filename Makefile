.PHONY: backend-test frontend-build lambda-test cdk-synth
backend-test:
	cd backend && mvn test
frontend-build:
	cd frontend && npm install && npm run build
lambda-test:
	cd lambdas/thumbnail-generator && python -m pip install -r requirements-dev.txt && pytest
cdk-synth:
	cd infrastructure && npm install && npm run build && npx cdk synth
