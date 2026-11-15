# Cost considerations

No fixed monthly cost is promised. Actual cost depends on region, task sizing, traffic, image storage, data transfer, request volume, log retention and free-tier eligibility.

Likely cost drivers: always-on ECS Fargate, ALB hourly/capacity charges, CloudFront egress/requests, S3 storage/requests, DynamoDB reads/writes/storage, Lambda duration, SQS requests, CloudWatch logs/metrics, Cognito monthly active users, and NAT Gateway if introduced.

Controls: create Budgets first; scale dev ECS desired count to zero when not testing (API unavailable while stopped); avoid NAT where service endpoints/public AWS service access meet requirements; lifecycle old objects; set log retention; start DynamoDB on-demand; avoid cross-region replication initially; delete dev stacks and inspect retained resources. Estimate with https://calculator.aws/.
