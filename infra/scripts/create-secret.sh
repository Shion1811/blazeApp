#!/usr/bin/env bash
# infra/lib/backend-stack.ts が参照する Secrets Manager シークレット
# `blazeapp/backend-{stage}`（例: blazeapp/backend-prod, blazeapp/backend-dev）を
# 作成する。既に存在する場合は値を更新する。
#
# CDK は stage ごとに別スタック・別シークレットを参照する（infra/bin/infra.ts 参照）ため、
# prod と dev でそれぞれこのスクリプトを実行して両方のシークレットを用意すること。
# STAGE でどちらを作るか指定する（未指定なら dev。誤って本番へ作らないための既定値）。
#
# 実行前に、下の環境変数に実際の値を設定してから実行すること。
#   DATABASE_URL / REDIS_URL / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY /
#   AWS_S3_BUCKET / RESEND_API_KEY
#
# 実行例（dev 用シークレット blazeapp/backend-dev を作成/更新）:
#   STAGE=dev \
#   DATABASE_URL=postgres://... REDIS_URL=redis://... \
#   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
#   AWS_S3_BUCKET=... RESEND_API_KEY=... \
#   ./create-secret.sh
#
# prod 用は STAGE=prod を指定する。
# シークレット名を直接上書きしたい場合は SECRET_NAME=... を渡す（STAGE より優先）。

set -euo pipefail

STAGE="${STAGE:-dev}"
SECRET_NAME="${SECRET_NAME:-blazeapp/backend-${STAGE}}"

for key in DATABASE_URL REDIS_URL AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_S3_BUCKET RESEND_API_KEY; do
  if [ -z "${!key:-}" ]; then
    echo "!! ${key} が未設定です。環境変数として値を渡してから実行してください。" >&2
    exit 1
  fi
done

SECRET_JSON=$(cat <<EOF
{
  "DATABASE_URL": "${DATABASE_URL}",
  "REDIS_URL": "${REDIS_URL}",
  "AWS_ACCESS_KEY_ID": "${AWS_ACCESS_KEY_ID}",
  "AWS_SECRET_ACCESS_KEY": "${AWS_SECRET_ACCESS_KEY}",
  "AWS_S3_BUCKET": "${AWS_S3_BUCKET}",
  "RESEND_API_KEY": "${RESEND_API_KEY}"
}
EOF
)

# AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY はここではアプリ(S3用)の値として
# 受け取っているだけで、AWS CLI自身の認証に使わせてはいけない。
# 環境変数に残したまま aws コマンドを呼ぶと、~/.aws/credentials より優先されて
# 誤ってこの値で認証しようとし、UnrecognizedClientException になる。
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN

if aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" >/dev/null 2>&1; then
  echo "既存のシークレット ${SECRET_NAME} を更新します。"
  aws secretsmanager put-secret-value \
    --secret-id "${SECRET_NAME}" \
    --secret-string "${SECRET_JSON}"
else
  echo "シークレット ${SECRET_NAME} を新規作成します。"
  aws secretsmanager create-secret \
    --name "${SECRET_NAME}" \
    --secret-string "${SECRET_JSON}"
fi

echo "完了: ${SECRET_NAME}"
