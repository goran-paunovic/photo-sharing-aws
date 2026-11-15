#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {StorageStack} from '../lib/stacks/storage-stack';
import {DatabaseStack} from '../lib/stacks/database-stack';
import {IdentityStack} from '../lib/stacks/identity-stack';
import {ProcessingStack} from '../lib/stacks/processing-stack';
import {BackendStack} from '../lib/stacks/backend-stack';
import {DeliveryStack} from '../lib/stacks/delivery-stack';
const app=new cdk.App();
const env={account:process.env.CDK_DEFAULT_ACCOUNT,region:process.env.CDK_DEFAULT_REGION??'eu-central-1'};
const storage=new StorageStack(app,'PhotoStorage',{env});
const database=new DatabaseStack(app,'PhotoDatabase',{env});
const identity=new IdentityStack(app,'PhotoIdentity',{env});
new ProcessingStack(app,'PhotoProcessing',{env,originalsBucket:storage.originalsBucket,processedBucket:storage.processedBucket,photosTable:database.photosTable});
const backend=new BackendStack(app,'PhotoBackend',{env,photosTable:database.photosTable,sharesTable:database.sharesTable,originalsBucket:storage.originalsBucket,processedBucket:storage.processedBucket,cognitoIssuerUri:`https://cognito-idp.${env.region}.amazonaws.com/${identity.userPool.userPoolId}`});
new DeliveryStack(app,'PhotoDelivery',{env,frontendBucket:storage.frontendBucket,processedBucket:storage.processedBucket,apiLoadBalancer:backend.loadBalancer});
