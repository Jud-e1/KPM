import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class KpmDataStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly frontendSecurityGroup: ec2.SecurityGroup;
  public readonly backendSecurityGroup: ec2.SecurityGroup;
  public readonly workerSecurityGroup: ec2.SecurityGroup;
  public readonly database: rds.DatabaseCluster;
  public readonly databaseSecret: secretsmanager.ISecret;
  public readonly appSecret: secretsmanager.Secret;
  public readonly mlToken: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: this.vpc,
      description: 'Internet entry for the KPM load balancer',
      allowAllOutbound: true,
    });
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');

    this.frontendSecurityGroup = new ec2.SecurityGroup(this, 'FrontendSg', {
      vpc: this.vpc,
      description: 'Next.js tasks',
      allowAllOutbound: true,
    });
    this.backendSecurityGroup = new ec2.SecurityGroup(this, 'BackendSg', {
      vpc: this.vpc,
      description: 'FastAPI tasks',
      allowAllOutbound: true,
    });
    this.workerSecurityGroup = new ec2.SecurityGroup(this, 'WorkerSg', {
      vpc: this.vpc,
      description: 'ML worker tasks',
      allowAllOutbound: true,
    });

    this.frontendSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(3000), 'ALB to frontend');
    this.backendSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(8000), 'ALB to API');
    this.backendSecurityGroup.addIngressRule(this.workerSecurityGroup, ec2.Port.tcp(8000), 'ML worker to API');

    this.database = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_17_9,
      }),
      credentials: rds.Credentials.fromGeneratedSecret('kpm'),
      defaultDatabaseName: 'kpm_db',
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      writer: rds.ClusterInstance.serverlessV2('Writer', {
        publiclyAccessible: false,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 1,
      storageEncrypted: true,
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      backup: { retention: cdk.Duration.days(7) },
      cloudwatchLogsExports: ['postgresql'],
    });
    this.database.connections.allowDefaultPortFrom(this.backendSecurityGroup, 'API to Aurora');
    this.database.connections.allowDefaultPortFrom(this.workerSecurityGroup, 'ML worker to Aurora');

    const databaseSecret = this.database.secret;
    if (!databaseSecret) {
      throw new Error('Aurora credentials secret was not created');
    }
    databaseSecret.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.databaseSecret = databaseSecret;

    this.appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      description: 'KPM backend SECRET_KEY',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 48,
      },
    });
    this.appSecret.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    this.mlToken = new secretsmanager.Secret(this, 'MlToken', {
      description: 'Shared token for the ML worker to call the API',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 48,
      },
    });
    this.mlToken.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.clusterEndpoint.hostname,
    });
  }
}
