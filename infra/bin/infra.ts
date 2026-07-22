#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BackendStack } from "../lib/backend-stack";

const app = new cdk.App();

// main→prod、dev→dev。CI側で `cdk deploy --context stage=prod/dev` として渡す（deploy.yml参照）。
// ローカル実行時は未指定なら dev 扱いにして、誤って本番に触れないようにする。
const stage = (app.node.tryGetContext("stage") as string | undefined) ?? "dev";

// スタック名にstageを含めることで、prod/devが完全に別のVPC・ECSクラスタ・ALBを持つようにする
new BackendStack(app, `BlazeAppBackendStack-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    // back/src が実行時に読む AWS_REGION と揃えること
    region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
  },
});
