import * as cdk from 'aws-cdk-lib';import {Construct} from 'constructs';import * as cognito from 'aws-cdk-lib/aws-cognito';
export class IdentityStack extends cdk.Stack {
 public readonly userPool:cognito.UserPool;
 constructor(scope:Construct,id:string,props?:cdk.StackProps){super(scope,id,props);const pool=new cognito.UserPool(this,'UserPool',{selfSignUpEnabled:true,signInAliases:{email:true},autoVerify:{email:true},passwordPolicy:{minLength:12,requireDigits:true,requireLowercase:true,requireUppercase:true,requireSymbols:true},removalPolicy:cdk.RemovalPolicy.RETAIN});
 this.userPool=pool;const client=pool.addClient('WebClient',{generateSecret:false,authFlows:{userSrp:true},preventUserExistenceErrors:true});new cdk.CfnOutput(this,'UserPoolId',{value:pool.userPoolId});new cdk.CfnOutput(this,'UserPoolClientId',{value:client.userPoolClientId});new cdk.CfnOutput(this,'CognitoIssuerUri',{value:`https://cognito-idp.${cdk.Stack.of(this).region}.amazonaws.com/${pool.userPoolId}`});}
}
