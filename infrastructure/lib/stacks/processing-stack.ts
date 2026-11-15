import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';

interface Props extends cdk.StackProps {
  originalsBucket: s3.IBucket;
  processedBucket: s3.IBucket;
  photosTable: ddb.ITable;
}

export class ProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const dlq = new sqs.Queue(this, 'ProcessingDLQ', {
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    const queue = new sqs.Queue(this, 'ProcessingQueue', {
      visibilityTimeout: cdk.Duration.seconds(180),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 4 },
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Route S3 object-created events through EventBridge. This avoids the
    // cross-stack S3 notification dependency cycle between storage and processing.
    new events.Rule(this, 'OriginalPhotoCreatedRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [props.originalsBucket.bucketName] },
          object: { key: [{ prefix: 'originals/' }] },
        },
      },
      targets: [new targets.SqsQueue(queue)],
    });

    const fn = new lambda.Function(this, 'ThumbnailFunction', {
      runtime: lambda.Runtime.PYTHON_3_14,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset(
        path.resolve(__dirname, '../../../lambdas/thumbnail-generator'),
        {
          bundling: {
            image: lambda.Runtime.PYTHON_3_14.bundlingImage,
            command: [
              'bash',
              '-c',
              'pip install -r requirements.txt -t /asset-output && cp handler.py /asset-output',
            ],
          },
        },
      ),
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      environment: {
        PROCESSED_BUCKET: props.processedBucket.bucketName,
        PHOTOS_TABLE: props.photosTable.tableName,
      },
    });

    props.originalsBucket.grantRead(fn, 'originals/*');
    props.processedBucket.grantPut(fn, 'thumbnails/*');
    props.processedBucket.grantPut(fn, 'medium/*');
    props.photosTable.grantReadWriteData(fn);
    fn.addEventSource(new sources.SqsEventSource(queue, {
      batchSize: 5,
      reportBatchItemFailures: true,
    }));
  }
}
