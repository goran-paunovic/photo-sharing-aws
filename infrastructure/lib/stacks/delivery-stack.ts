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

    const frontendOac = new cf.S3OriginAccessControl(this, 'FrontendOAC', {
      signing: cf.Signing.SIGV4_ALWAYS,
    });
    const imageOac = new cf.S3OriginAccessControl(this, 'ImagesOAC', {
      signing: cf.Signing.SIGV4_ALWAYS,
    });

    const spaRewrite = new cf.Function(this, 'SpaRewrite', {
      code: cf.FunctionCode.fromInline(
        "function handler(event) { var request = event.request; var uri = request.uri; if (!uri.startsWith('/api/') && !uri.startsWith('/images/') && !uri.includes('.')) { request.uri = '/index.html'; } return request; }",
      ),
    });

    const distribution = new cf.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(
          props.frontendBucket,
          { originAccessControl: frontendOac },
        ),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [{
          eventType: cf.FunctionEventType.VIEWER_REQUEST,
          function: spaRewrite,
        }],
      },
      additionalBehaviors: {
        '/images/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(
            props.processedBucket,
            { originAccessControl: imageOac },
          ),
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
    // OAC authenticates CloudFront to S3; it does not authorize individual viewers.
  }
}
