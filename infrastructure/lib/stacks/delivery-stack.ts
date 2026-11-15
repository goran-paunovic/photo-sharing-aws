import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

interface Props extends cdk.StackProps {
  frontendBucket: s3.IBucket;
  processedBucket: s3.IBucket;
  apiLoadBalancer: elbv2.IApplicationLoadBalancer;
}

export class DeliveryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // S3Origin creates its Origin Access Identity in the bucket's stack when
    // the bucket is cross-stack. This keeps the bucket policy independent of
    // the Distribution resource and avoids a CloudFormation dependency cycle.
    // OAI is legacy; migrate to OAC after consolidating the bucket and
    // distribution policy lifecycle so the distribution ARN can be scoped safely.
    const spaRewrite = new cf.Function(this, 'SpaRewrite', {
      code: cf.FunctionCode.fromInline(
        "function handler(event) { var request = event.request; var uri = request.uri; if (!uri.startsWith('/api/') && !uri.startsWith('/images/') && !uri.includes('.')) { request.uri = '/index.html'; } return request; }",
      ),
    });

    const distribution = new cf.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new origins.S3Origin(props.frontendBucket),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [{
          eventType: cf.FunctionEventType.VIEWER_REQUEST,
          function: spaRewrite,
        }],
      },
      additionalBehaviors: {
        '/images/*': {
          origin: new origins.S3Origin(props.processedBucket),
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
        },
        '/api/*': {
          origin: new origins.LoadBalancerV2Origin(props.apiLoadBalancer, {
            protocolPolicy: cf.OriginProtocolPolicy.HTTP_ONLY,
            httpPort: 80,
          }),
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cf.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cf.AllowedMethods.ALLOW_ALL,
        },
      },
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
    });

    // TODO: add a trusted key group and signed URL/cookie policy for private image viewers.
    // OAI authenticates CloudFront to S3; it does not authorize individual viewers.
  }
}
