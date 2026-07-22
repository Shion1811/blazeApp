#!/usr/bin/env bash
# GitHub Actions が OIDC でAWSに一時クレデンシャル認証するための
# IDプロバイダとIAMロール(GitHubActionsWorkflowRole)を作成する。
#
# 前提: ローカルで `aws configure` 等により管理者権限のAWS認証情報が設定済みであること。
# 実行例:
#   AWS_ACCOUNT_ID=123456789012 GITHUB_REPO=vantan-production/blazeApp ./setup-aws-oidc.sh

set -euo pipefail

: "${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID を指定してください (例: 123456789012)}"
GITHUB_REPO="${GITHUB_REPO:-vantan-production/blazeApp}"
ROLE_NAME="${ROLE_NAME:-GitHubActionsWorkflowRole}"
OIDC_URL="token.actions.githubusercontent.com"

echo "== OIDCプロバイダの確認/作成 =="
if aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/${OIDC_URL}" >/dev/null 2>&1; then
  echo "OIDCプロバイダは既に存在します。スキップします。"
else
  aws iam create-open-id-connect-provider \
    --url "https://${OIDC_URL}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1"
  echo "OIDCプロバイダを作成しました。"
fi

echo "== 信頼ポリシーを作成 =="
TRUST_POLICY_FILE="$(mktemp)"
cat > "${TRUST_POLICY_FILE}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/${OIDC_URL}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "${OIDC_URL}:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "${OIDC_URL}:sub": "repo:${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

echo "== IAMロールの確認/作成 =="
if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  echo "ロール ${ROLE_NAME} は既に存在します。信頼ポリシーのみ更新します。"
  aws iam update-assume-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-document "file://${TRUST_POLICY_FILE}"
else
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document "file://${TRUST_POLICY_FILE}"
  echo "ロールを作成しました。"
fi

echo "== 権限ポリシーをアタッチ =="
# CDKでVPC/ECS/ALB/ECR/SecretsManagerなど広範なリソースを作成するため、
# 最初は AdministratorAccess を付与し、運用が安定してから必要最小権限に絞り込むこと。
aws iam attach-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-arn "arn:aws:iam::aws:policy/AdministratorAccess"

rm -f "${TRUST_POLICY_FILE}"

echo ""
echo "完了: arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"
echo "この ARN が back/.github/workflows/deploy.yml の role-to-assume と一致することを確認してください。"
