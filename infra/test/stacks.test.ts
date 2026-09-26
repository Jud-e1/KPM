import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { KpmAppStack } from '../lib/app-stack';
import { KpmDataStack } from '../lib/data-stack';

const env = { account: '123456789012', region: 'us-east-1' };

function testApp(): cdk.App {
  return new cdk.App({
    context: {
      'availability-zones:account=123456789012:region=us-east-1': ['us-east-1a', 'us-east-1b'],
    },
  });
}

describe('KPM stacks', () => {
  it('runs Aurora PostgreSQL and three Fargate services behind one load balancer', () => {
    const app = testApp();
    const data = new KpmDataStack(app, 'KpmData', { env });
    const image = ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/nginx:stable');
    const application = new KpmAppStack(app, 'KpmApp', {
      env,
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
      images: { frontend: image, backend: image, worker: image },
    });

    const dataTemplate = Template.fromStack(data);
    dataTemplate.hasResourceProperties('AWS::RDS::DBCluster', {
      Engine: 'aurora-postgresql',
      EngineVersion: '17.9',
      DatabaseName: 'kpm_db',
      StorageEncrypted: true,
      DeletionProtection: true,
      ServerlessV2ScalingConfiguration: {
        MinCapacity: 0.5,
        MaxCapacity: 1,
      },
    });
    dataTemplate.resourceCountIs('AWS::EC2::NatGateway', 1);

    const appTemplate = Template.fromStack(application);
    appTemplate.resourceCountIs('AWS::ECS::Service', 3);
    appTemplate.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internet-facing',
    });
    appTemplate.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'backend',
          Environment: Match.arrayWith([
            Match.objectLike({ Name: 'POSTGRES_SSLMODE', Value: 'require' }),
          ]),
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: 'POSTGRES_PASSWORD' }),
            Match.objectLike({ Name: 'SECRET_KEY' }),
            Match.objectLike({ Name: 'ML_SERVICE_TOKEN' }),
          ]),
        }),
      ]),
    });

    const backendTask = appTemplate.findResources('AWS::ECS::TaskDefinition', {
      Properties: {
        ContainerDefinitions: Match.arrayWith([Match.objectLike({ Name: 'backend' })]),
      },
    });
    const backendJson = JSON.stringify(backendTask);
    assert.equal(backendJson.includes('POSTGRES_PASSWORD'), true);
    assert.equal(backendJson.includes('"Value":"postgres"'), false);
  });
});
