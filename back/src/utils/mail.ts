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

// 体験申し込みの通知に使う入力データ
export interface TrialApplicationMailData {
  email: string;
  name: string;
  furigana: string;
  trialDate: string;
  gender: "male" | "female" | "other";
  birthDate: string;
  schoolName: string;
  cramSchool?: string;
  phoneNumber: string;
  motivation: "flyer" | "instagram" | "referral" | "other";
  motivationOther?: string;
  referrerName?: string;
}

// メールHTMLに埋め込む前にユーザー入力をエスケープする（HTML/メールインジェクション対策）
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const GENDER_LABELS: Record<TrialApplicationMailData["gender"], string> = {
  male: "男性",
  female: "女性",
  other: "その他",
};

const MOTIVATION_LABELS: Record<TrialApplicationMailData["motivation"], string> = {
  flyer: "学校で配布されたチラシ",
  instagram: "インスタグラム",
  referral: "西尾ブレイズの選手、スタッフからの紹介",
  other: "その他",
};

function formatMotivation(data: TrialApplicationMailData): string {
  if (data.motivation === "other" && data.motivationOther) {
    return `${MOTIVATION_LABELS.other}（${escapeHtml(data.motivationOther)}）`;
  }
  if (data.motivation === "referral" && data.referrerName) {
    return `${MOTIVATION_LABELS.referral}（紹介者: ${escapeHtml(data.referrerName)}）`;
  }
  return MOTIVATION_LABELS[data.motivation];
}

/**
 * 体験申し込みの受付確認メールを申込者に送信する
 * テスト環境（NODE_ENV=test）では実送信せずスキップする
 */
export async function sendTrialApplicationConfirmationEmail(
  data: TrialApplicationMailData,
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;

  const { error } = await getResendClient().emails.send({
    from: MAIL_FROM,
    to: data.email,
    subject: "【西尾ブレイズ】体験申し込みを受け付けました",
    html: `
      <p>${escapeHtml(data.name)} 様</p>
      <p>体験申し込みを受け付けました。担当者よりご連絡いたしますので、しばらくお待ちください。</p>
      <p>体験日: ${escapeHtml(data.trialDate)}</p>
      <p>このメールに心当たりがない場合は、本メールを無視してください。</p>
    `,
  });

  if (error) {
    throw new Error(`体験申し込み確認メールの送信に失敗しました: ${error.message}`);
  }
}

// 体験申し込みの通知先（カンマ区切りで複数指定可）
const TRIAL_NOTIFICATION_EMAILS = process.env.TRIAL_NOTIFICATION_EMAIL
  ? process.env.TRIAL_NOTIFICATION_EMAIL.split(",").map((e) => e.trim()).filter(Boolean)
  : [];

/**
 * 体験申し込みがあったことを管理者宛に通知する
 * TRIAL_NOTIFICATION_EMAIL未設定時・テスト環境では実送信せずスキップする
 */
export async function sendTrialApplicationAdminNotification(
  data: TrialApplicationMailData,
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  if (TRIAL_NOTIFICATION_EMAILS.length === 0) {
    console.warn("[trial-application] TRIAL_NOTIFICATION_EMAIL未設定のため通知メールをスキップしました");
    return;
  }

  const { error } = await getResendClient().emails.send({
    from: MAIL_FROM,
    to: TRIAL_NOTIFICATION_EMAILS,
    subject: "【西尾ブレイズ】新しい体験申し込みがありました",
    html: `
      <p>新しい体験申し込みがありました。</p>
      <ul>
        <li>体験日: ${escapeHtml(data.trialDate)}</li>
        <li>名前: ${escapeHtml(data.name)}（${escapeHtml(data.furigana)}）</li>
        <li>性別: ${GENDER_LABELS[data.gender]}</li>
        <li>生年月日: ${escapeHtml(data.birthDate)}</li>
        <li>学校名: ${escapeHtml(data.schoolName)}</li>
        <li>塾: ${data.cramSchool ? escapeHtml(data.cramSchool) : "なし"}</li>
        <li>メールアドレス: ${escapeHtml(data.email)}</li>
        <li>電話番号: ${escapeHtml(data.phoneNumber)}</li>
        <li>きっかけ: ${formatMotivation(data)}</li>
      </ul>
    `,
  });

  if (error) {
    throw new Error(`体験申し込み通知メールの送信に失敗しました: ${error.message}`);
  }
}
