import path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ContainerImages {
  readonly frontend: ecs.ContainerImage;
  readonly backend: ecs.ContainerImage;
  readonly worker: ecs.ContainerImage;
}

export interface KpmAppStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly albSecurityGroup: ec2.ISecurityGroup;
  readonly frontendSecurityGroup: ec2.ISecurityGroup;
  readonly backendSecurityGroup: ec2.ISecurityGroup;
  readonly workerSecurityGroup: ec2.ISecurityGroup;
  readonly databaseHost: string;
  readonly databasePort: string;
  readonly databaseSecret: secretsmanager.ISecret;
  readonly appSecret: secretsmanager.ISecret;
  readonly mlToken: secretsmanager.ISecret;
  readonly googleClientId?: string;
  readonly images?: ContainerImages;
}

export class KpmAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: KpmAppStackProps) {
    super(scope, id, props);

    const images = props.images ?? buildImages(this, props.googleClientId ?? '');
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });
    cluster.addDefaultCloudMapNamespace({ name: 'kpm.local' });

    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });
    alb.setAttribute('routing.http.drop_invalid_header_fields.enabled', 'true');

    const listener = alb.addListener('Http', {
      port: 80,
      open: false,
    });

    const frontendService = this.webService(cluster, props, 'Frontend', {
      image: images.frontend,
      port: 3000,
      cpu: 512,
      memoryLimitMiB: 1024,
      securityGroup: props.frontendSecurityGroup,
      environment: {
        NEXT_PUBLIC_API_URL: '/api/v1',
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: props.googleClientId ?? '',
      },
    });
    const backendService = this.webService(cluster, props, 'Backend', {
      image: images.backend,
      port: 8000,
      cpu: 512,
      memoryLimitMiB: 1024,
      securityGroup: props.backendSecurityGroup,
      environment: {
        ...databaseEnvironment(props),
        PROJECT_NAME: 'KPM Full-Stack App',
        API_V1_STR: '/api/v1',
        ENVIRONMENT: 'production',
        DEBUG: 'false',
        OPENAI_MODEL: 'gpt-4o-mini',
        GOOGLE_CLIENT_ID: props.googleClientId ?? '',
        BACKEND_CORS_ORIGINS: cdk.Fn.join('', ['["http://', alb.loadBalancerDnsName, '"]']),
      },
      secrets: {
        ...databaseSecrets(props),
        SECRET_KEY: ecs.Secret.fromSecretsManager(props.appSecret),
        ML_SERVICE_TOKEN: ecs.Secret.fromSecretsManager(props.mlToken),
      },
      cloudMapName: 'backend',
    });

    this.workerService(cluster, props, images.worker);

    listener.addTargets('Frontend', {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [frontendService],
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck: {
        path: '/',
        healthyHttpCodes: '200-399',
      },
    });
    listener.addTargets('Api', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/*', '/docs', '/docs/*', '/redoc', '/redoc/*']),
      ],
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [backendService],
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck: {
        path: '/api/v1/health',
        healthyHttpCodes: '200',
      },
    });

    new cdk.CfnOutput(this, 'AlbUrl', {
      value: `http://${alb.loadBalancerDnsName}`,
    });
  }

  private webService(
    cluster: ecs.Cluster,
    props: KpmAppStackProps,
    id: string,
    options: {
      readonly image: ecs.ContainerImage;
      readonly port: number;
      readonly cpu: number;
      readonly memoryLimitMiB: number;
      readonly securityGroup: ec2.ISecurityGroup;
      readonly environment: Record<string, string>;
      readonly secrets?: Record<string, ecs.Secret>;
      readonly cloudMapName?: string;
    },
  ): ecs.FargateService {
    const taskDefinition = new ecs.FargateTaskDefinition(this, `${id}Task`, {
      cpu: options.cpu,
      memoryLimitMiB: options.memoryLimitMiB,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    taskDefinition.addContainer(id.toLowerCase(), {
      image: options.image,
      logging: logDriver(this, id),
      environment: options.environment,
      secrets: options.secrets,
      portMappings: [{ containerPort: options.port }],
    });

    return new ecs.FargateService(this, `${id}Service`, {
      cluster,
      taskDefinition,
      desiredCount: 1,
      securityGroups: [options.securityGroup],
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      healthCheckGracePeriod: cdk.Duration.seconds(90),
      cloudMapOptions: options.cloudMapName ? { name: options.cloudMapName } : undefined,
    });
  }

  private workerService(cluster: ecs.Cluster, props: KpmAppStackProps, image: ecs.ContainerImage): void {
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'WorkerTask', {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    taskDefinition.addContainer('worker', {
      image,
      logging: logDriver(this, 'Worker'),
      environment: {
        ...databaseEnvironment(props),
        ENVIRONMENT: 'production',
        CORE_API_BASE: 'http://backend.kpm.local:8000/api/v1',
        POLL_INTERVAL_SEC: '5',
      },
      secrets: {
        ...databaseSecrets(props),
        ML_SERVICE_TOKEN: ecs.Secret.fromSecretsManager(props.mlToken),
      },
    });
    new ecs.FargateService(this, 'WorkerService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      securityGroups: [props.workerSecurityGroup],
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      minHealthyPercent: 0,
    });
  }
}

function databaseEnvironment(props: KpmAppStackProps): Record<string, string> {
  return {
    POSTGRES_SERVER: props.databaseHost,
    POSTGRES_PORT: props.databasePort,
    POSTGRES_DB: 'kpm_db',
    POSTGRES_SSLMODE: 'require',
  };
}

function databaseSecrets(props: KpmAppStackProps): Record<string, ecs.Secret> {
  return {
    POSTGRES_USER: ecs.Secret.fromSecretsManager(props.databaseSecret, 'username'),
    POSTGRES_PASSWORD: ecs.Secret.fromSecretsManager(props.databaseSecret, 'password'),
  };
}

function logDriver(scope: Construct, id: string): ecs.LogDriver {
  const logGroup = new logs.LogGroup(scope, `${id}Logs`, {
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });
  return ecs.LogDrivers.awsLogs({
    streamPrefix: id.toLowerCase(),
    logGroup,
  });
}

function buildImages(scope: Construct, googleClientId: string): ContainerImages {
  const directory = path.join(__dirname, '..', '..');
  const backend = new ecrAssets.DockerImageAsset(scope, 'BackendImage', {
    directory,
    file: 'Dockerfile',
    target: 'backend',
    platform: ecrAssets.Platform.LINUX_AMD64,
  });
  const worker = new ecrAssets.DockerImageAsset(scope, 'WorkerImage', {
    directory,
    file: 'Dockerfile',
    target: 'ml-service',
    platform: ecrAssets.Platform.LINUX_AMD64,
  });
  const frontend = new ecrAssets.DockerImageAsset(scope, 'FrontendImage', {
    directory,
    file: 'Dockerfile',
    target: 'frontend',
    platform: ecrAssets.Platform.LINUX_AMD64,
    buildArgs: {
      NEXT_PUBLIC_API_URL: '/api/v1',
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: googleClientId,
    },
  });
  return {
    backend: ecs.ContainerImage.fromDockerImageAsset(backend),
    worker: ecs.ContainerImage.fromDockerImageAsset(worker),
    frontend: ecs.ContainerImage.fromDockerImageAsset(frontend),
  };
}
