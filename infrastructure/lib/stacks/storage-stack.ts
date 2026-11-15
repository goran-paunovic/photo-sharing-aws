import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class StorageStack extends cdk.Stack {
  public readonly originalsBucket: s3.Bucket;
  public readonly processedBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const common = {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    };

    this.originalsBucket = new s3.Bucket(this, 'Originals', {
      ...common,
      eventBridgeEnabled: true,
      lifecycleRules: [
        { abortIncompleteMultipartUploadAfter: cdk.Duration.days(7) },
      ],
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        exposedHeaders: ['ETag'],
        maxAge: 3600,
      }],
    });

    this.processedBucket = new s3.Bucket(this, 'Processed', { ...common });
    this.frontendBucket = new s3.Bucket(this, 'Frontend', {
      ...common,
      versioned: false,
    });

    new cdk.CfnOutput(this, 'OriginalsBucketName', {
      value: this.originalsBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'ProcessedBucketName', {
      value: this.processedBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
    });
  }
}
