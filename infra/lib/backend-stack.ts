import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as logs from "aws-cdk-lib/aws-logs";

export interface BackendStackProps extends cdk.StackProps {
  // "prod" | "dev" など。スタック名・シークレット名の分離に使う（infra/bin/infra.ts参照）
  stage: string;
}

/**
 * back（Hono API）を ECS Fargate + ALB で常駐起動するスタック。
 * stageごと（prod/dev）に別スタックとしてデプロイされ、VPC・ECSクラスタ・ALB・シークレットは
 * 完全に独立する。dev への変更が prod に影響することはない。
 *
 * 前提・仮の値（実際の運用開始前に見直すこと）:
 * - DB(Postgres)・Redisは本スタックでは作成しない。DATABASE_URL / REDIS_URL で
 *   外部のマネージドサービスに接続する前提（back/src/db の SSL 設定が本番想定）。
 * - VPCは新規作成・NATゲートウェイなし（コスト最小化のため、タスクはパブリックサブネットに
 *   パブリックIPを持たせて配置）。DBがVPC外にある間はこれで動くが、将来RDS等をVPC内に
 *   置く場合はプライベートサブネット + NATゲートウェイに切り替えること。
 * - 機微な環境変数は Secrets Manager のシークレット1つにJSONでまとめて格納する想定。
 *   デプロイ前に stageごとの `blazeapp/backend-{stage}`（例: blazeapp/backend-prod,
 *   blazeapp/backend-dev）という名前のシークレットを手動作成し、下記 SECRET_ENV_KEYS の
 *   キーを持つJSONを値として登録しておくこと。
 */
export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);
    const { stage } = props;

    // back/src が process.env から読む値のうち、機微情報として扱うキー
    // （Secrets Manager 側にこの名前のキーを用意しておく）
    const SECRET_ENV_KEYS = [
      "DATABASE_URL",
      "REDIS_URL",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_S3_BUCKET",
      "RESEND_API_KEY",
    ] as const;

    // 非機微な設定値。CDKデプロイ時に -c corsOrigin=... 等で必ず指定する。
    // 指定し忘れてダミードメインのままデプロイされる（CORSエラーやメール内リンク破損に繋がる）のを防ぐため、
    // 未指定ならここでデプロイを止める。
    const requireContext = (key: string): string => {
      const value = this.node.tryGetContext(key);
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(
          `-c ${key}=... の指定が必要です（例: npx cdk deploy -c ${key}=https://example.com -c stage=${stage}）`,
        );
      }
      return value;
    };
    const corsOrigin = requireContext("corsOrigin");
    const frontendUrl = requireContext("frontendUrl");
    const mailFrom = requireContext("mailFrom");

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    // デプロイ前に手動作成しておく前提のシークレット（stageごとに別シークレット）
    const appSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "AppSecret",
      `blazeapp/backend-${stage}`,
    );

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "BackendService",
      {
        cluster,
        cpu: 512,
        memoryLimitMiB: 1024,
        desiredCount: 1,
        publicLoadBalancer: true,
        assignPublicIp: true,
        taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        listenerPort: 80,
        taskImageOptions: {
          // back/Dockerfile からビルド（`cdk deploy` 実行時にDockerビルド＋ECRアセット登録まで行う）
          image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../../back")),
          containerPort: 8080,
          environment: {
            NODE_ENV: "production",
            PORT: "8080",
            AWS_REGION: this.region,
            CORS_ORIGIN: corsOrigin,
            FRONTEND_URL: frontendUrl,
            MAIL_FROM: mailFrom,
          },
          secrets: Object.fromEntries(
            SECRET_ENV_KEYS.map((key) => [
              key,
              ecs.Secret.fromSecretsManager(appSecret, key),
            ]),
          ),
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: "backend",
            logRetention: logs.RetentionDays.TWO_WEEKS,
          }),
        },
      },
    );

    // ALBのヘルスチェックは /health を見る（back/src/app.ts 参照）
    service.targetGroup.configureHealthCheck({
      path: "/health",
      healthyHttpCodes: "200",
    });

    // S3クライアントを task role のIAM権限で動かす場合の受け皿（推奨の移行先）。
    // 現状の back/src/db/s3.ts は AWS_ACCESS_KEY_ID/SECRET を明示指定しているため、
    // 移行するまではこの権限は使われないが、切り替え時に困らないよう先に付与しておく。
    // 実際のバケット名が確定したら bucketArn を差し替えること。
    // service.taskDefinition.taskRole.addToPrincipalPolicy(...)

    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: service.loadBalancer.loadBalancerDnsName,
      description: "この値を front の NEXT_PUBLIC_API_URL / CORS_ORIGIN の設定に使う",
    });
  }
}
