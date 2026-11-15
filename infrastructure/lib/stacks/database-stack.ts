import * as cdk from 'aws-cdk-lib';import {Construct} from 'constructs';import * as ddb from 'aws-cdk-lib/aws-dynamodb';
export class DatabaseStack extends cdk.Stack {
 public readonly photosTable:ddb.Table;public readonly sharesTable:ddb.Table;
 constructor(scope:Construct,id:string,props?:cdk.StackProps){super(scope,id,props);
 this.photosTable=new ddb.Table(this,'Photos',{partitionKey:{name:'photoId',type:ddb.AttributeType.STRING},billingMode:ddb.BillingMode.PAY_PER_REQUEST,encryption:ddb.TableEncryption.AWS_MANAGED,pointInTimeRecovery:true,removalPolicy:cdk.RemovalPolicy.RETAIN});
 this.photosTable.addGlobalSecondaryIndex({indexName:'ByOwnerAndCreatedAt',partitionKey:{name:'userId',type:ddb.AttributeType.STRING},sortKey:{name:'createdAtPhotoId',type:ddb.AttributeType.STRING},projectionType:ddb.ProjectionType.ALL});
 this.sharesTable=new ddb.Table(this,'Shares',{partitionKey:{name:'shareId',type:ddb.AttributeType.STRING},billingMode:ddb.BillingMode.PAY_PER_REQUEST,encryption:ddb.TableEncryption.AWS_MANAGED,timeToLiveAttribute:'expiresAtEpoch',pointInTimeRecovery:true,removalPolicy:cdk.RemovalPolicy.RETAIN});}
}
