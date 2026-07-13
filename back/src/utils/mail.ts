// メール送信ユーティリティ（Resend）

import { Resend } from "resend";

// モジュールロード時ではなく初回送信時に生成する（RESEND_API_KEY未設定のテスト環境等でのimport時エラーを避けるため）
let resend: Resend | undefined;
function getResendClient(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

// 送信元アドレス（Resend側でドメイン検証済みのものを設定する）
const MAIL_FROM = process.env.MAIL_FROM ?? "onboarding@resend.dev";

// リセットリンクの生成に使うフロントエンドのオリジン
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

/**
 * パスワード再設定メールを送信する
 * テスト環境（NODE_ENV=test）では実送信せずスキップする
 * @param to - 送信先メールアドレス
 * @param token - リセットトークン（生値。DBにはハッシュのみ保存される）
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;

  const resetUrl = `${FRONTEND_URL}/admin/reset-password?token=${encodeURIComponent(token)}`;

  const { error } = await getResendClient().emails.send({
    from: MAIL_FROM,
    to,
    subject: "【西尾ブレイズ管理画面】パスワード再設定のご案内",
    html: `
      <p>パスワード再設定のリクエストを受け付けました。</p>
      <p>以下のリンクから新しいパスワードを設定してください（有効期限は1時間です）。</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>このリクエストに心当たりがない場合は、本メールを無視してください。</p>
    `,
  });

  if (error) {
    throw new Error(`パスワード再設定メールの送信に失敗しました: ${error.message}`);
  }
}
