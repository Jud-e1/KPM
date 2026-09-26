#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { KpmAppStack } from '../lib/app-stack';
import { KpmDataStack } from '../lib/data-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const googleClientIdContext = app.node.tryGetContext('googleClientId');
const googleClientId = typeof googleClientIdContext === 'string' ? googleClientIdContext : '';

const data = new KpmDataStack(app, 'KpmData', {
  env,
  terminationProtection: true,
  description: 'KPM network and Aurora PostgreSQL',
});

new KpmAppStack(app, 'KpmApp', {
  env,
  description: 'KPM Fargate services and load balancer',
  vpc: data.vpc,
  albSecurityGroup: data.albSecurityGroup,
  frontendSecurityGroup: data.frontendSecurityGroup,
  backendSecurityGroup: data.backendSecurityGroup,
  workerSecurityGroup: data.workerSecurityGroup,
  databaseHost: data.database.clusterEndpoint.hostname,
  databasePort: data.database.clusterEndpoint.port.toString(),
  databaseSecret: data.databaseSecret,
  appSecret: data.appSecret,
  mlToken: data.mlToken,
  googleClientId,
});
