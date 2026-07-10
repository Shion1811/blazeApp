// スキーマ設計

import { pgTable, uuid, varchar, timestamp, text, unique } from "drizzle-orm/pg-core";
import { z } from "zod";

// ヘルパー

// 全テーブル共通：id + created_at
const baseFields = {
  id: uuid("id").defaultRandom().primaryKey(),
  created_at: timestamp("created_at").defaultNow().notNull(),
};

// 更新日時も持つテーブル用（news・achievement）
const withUpdatedAt = {
  ...baseFields,
  updated_at: timestamp("updated_at").defaultNow().notNull(),
};

// S3パスカラム（任意、500文字以内）
const s3Path = (name: string) => varchar(name, { length: 500 });

// テーブル定義

// 管理者テーブル
export const admin = pgTable("users", {
  ...baseFields,
  // lengthは100文字以内 notNullで空文字は不可
  name: varchar("name", { length: 100 }).notNull(),
  // uniqueは重複を不可
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  token: varchar("token", { length: 64 }).unique(),
  token_issued_at: timestamp("token_issued_at").defaultNow().notNull(),
  // 削除日時（nullなら有効、セットされていれば削除済み・30日以内なら復活可能）
  deleted_at: timestamp("deleted_at"),
  // 権限ロール: 'owner' | 'admin' | 'member'（初回登録者が owner、以降は member）
  role: varchar("role", { length: 10 }).notNull().default("member"),
});

// ニュース / メディア情報テーブル（typeで分類）
export const news = pgTable("news", {
  ...withUpdatedAt,
  title: varchar("title", { length: 100 }).notNull(),
  body: text("body").notNull(),
  // メイン画像のS3パス（任意）
  img: s3Path("img"),
  // 'news' または 'media' でニュースとメディア情報を分ける
  type: varchar("type", { length: 10 }).notNull(),
  // 投稿した管理者のID（アカウント削除時はNULLになる）
  admin_id: uuid("admin_id").references(() => admin.id, {
    onDelete: "set null",
  }),
});

// 問い合わせテーブル
export const inquiry = pgTable("inquiry", {
  ...baseFields,
  // お客様の名前（ニックネーム可）
  name: varchar("name", { length: 100 }).notNull(),
  title: varchar("title", { length: 100 }).notNull(),
  body: text("body").notNull(),
  // 画像のS3パス（任意）
  img: s3Path("img"),
});

// 問い合わせ返信テーブル
export const reply = pgTable("reply", {
  ...baseFields,
  // どの問い合わせへの返信か
  inquiry_id: uuid("inquiry_id")
    .references(() => inquiry.id, { onDelete: "cascade" })
    .notNull(),
  // 返信した管理者のID（アカウント削除時はNULLになる）
  admin_id: uuid("admin_id").references(() => admin.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 100 }).notNull(),
  body: text("body").notNull(),
  // 画像のS3パス（任意）
  img: s3Path("img"),
  // ファイルのS3パス（任意）
  file: s3Path("file"),
});

// 実績テーブル
export const achievement = pgTable("achievement", {
  ...withUpdatedAt,
  title: varchar("title", { length: 100 }).notNull(),
  body: text("body").notNull(),
  // 画像のS3パス（任意）
  img: s3Path("img"),
  // 動画のS3パス（任意）
  movie: s3Path("movie"),
  // ファイルのS3パス（任意）
  file: s3Path("file"),
  // 投稿した管理者のID（アカウント削除時はNULLになる）
  admin_id: uuid("admin_id").references(() => admin.id, {
    onDelete: "set null",
  }),
});

// 試合風景テーブル
export const game = pgTable("game", {
  ...baseFields,
  // 画像のS3パス
  img: s3Path("img"),
  // 投稿した管理者のID（アカウント削除時はNULLになる）
  admin_id: uuid("admin_id").references(() => admin.id, {
    onDelete: "set null",
  }),
});

// 画像ストレージテーブル（複数画像対応）
export const images = pgTable("images", {
  ...baseFields,
  // S3上のパス
  path: varchar("path", { length: 500 }).notNull(),
  // 掲載同意ステータス（試合風景画像のみ使用）
  // 'pending': 未確認（デフォルト）, 'approved': 同意済み, 'rejected': 拒否
  consent_status: varchar("consent_status", { length: 10 }).notNull().default("pending"),
  // どのコンテンツに紐づくか（各FK、使う方だけ値が入る）
  news_id: uuid("news_id").references(() => news.id, { onDelete: "cascade" }),
  inquiry_id: uuid("inquiry_id").references(() => inquiry.id, {
    onDelete: "cascade",
  }),
  reply_id: uuid("reply_id").references(() => reply.id, {
    onDelete: "cascade",
  }),
  achievement_id: uuid("achievement_id").references(() => achievement.id, {
    onDelete: "cascade",
  }),
  game_id: uuid("game_id").references(() => game.id, { onDelete: "cascade" }),
});

// 動画ストレージテーブル
export const movies = pgTable("movies", {
  ...baseFields,
  path: varchar("path", { length: 500 }).notNull(),
  achievement_id: uuid("achievement_id").references(() => achievement.id, {
    onDelete: "cascade",
  }),
});

// ファイルストレージテーブル
export const files = pgTable("files", {
  ...baseFields,
  path: varchar("path", { length: 500 }).notNull(),
  inquiry_id: uuid("inquiry_id").references(() => inquiry.id, {
    onDelete: "cascade",
  }),
  reply_id: uuid("reply_id").references(() => reply.id, {
    onDelete: "cascade",
  }),
  achievement_id: uuid("achievement_id").references(() => achievement.id, {
    onDelete: "cascade",
  }),
});

// 他者アカウント削除リクエスト（owner合意用）
export const deletionRequests = pgTable("deletion_requests", {
  ...baseFields,
  // 削除対象ユーザー
  target_user_id: uuid("target_user_id")
    .references(() => admin.id, { onDelete: "cascade" })
    .notNull(),
  // リクエストを起こしたowner
  requested_by: uuid("requested_by")
    .references(() => admin.id, { onDelete: "cascade" })
    .notNull(),
  // 24時間で失効
  expires_at: timestamp("expires_at").notNull(),
});

// 削除リクエストへの承認（各ownerが1件ずつ）
export const deletionApprovals = pgTable("deletion_approvals", {
  ...baseFields,
  request_id: uuid("request_id")
    .references(() => deletionRequests.id, { onDelete: "cascade" })
    .notNull(),
  approved_by: uuid("approved_by")
    .references(() => admin.id, { onDelete: "cascade" })
    .notNull(),
}, (t) => ({
  uniqueApproval: unique("deletion_approvals_request_approved_uniq").on(t.request_id, t.approved_by),
}));

// パスワード再設定トークン（メールで送るのはtokenの生値、DBにはハッシュのみ保存）
export const passwordResetTokens = pgTable("password_reset_tokens", {
  ...baseFields,
  admin_id: uuid("admin_id")
    .references(() => admin.id, { onDelete: "cascade" })
    .notNull(),
  // sha256ハッシュ（hex64文字）。生トークンはDBに保存しない
  token_hash: varchar("token_hash", { length: 64 }).notNull().unique(),
  // 発行から1時間で失効
  expires_at: timestamp("expires_at").notNull(),
  // 使用済みなら日時が入る（再利用防止）
  used_at: timestamp("used_at"),
});

// バリデーションスキーマ

export const emailSchema = z
  .string()
  .email("メールアドレス形式が正しくありません。")
  // DBのvarchar(255)に合わせた上限
  .max(255, "メールアドレスは255文字以内で入力してください。")
  .regex(/^[\x21-\x7e]+$/, "半角英数字・記号のみ使用できます")
  .refine((val) => val.split("@").length === 2, {
    message: "@は1つだけ使用してください",
  });

export const passwordBaseSchema = z
  .string()
  .min(8, "パスワードは8文字以上で入力してください。")
  // bcryptは72バイト以上を無音で切り捨てるため上限を明示
  .max(72, "パスワードは72文字以内で入力してください。")
  .regex(/^[\x21-\x7e]+$/, "半角英数字・記号のみ使用できます。");

// 投稿系の共通バリデーション（設計書のルールに基づく）
const stringField = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label}を入力してください。`)
    .max(max, `${label}は${max}文字以内で入力してください。`);

export const titleSchema = stringField(1, 50, "タイトル");
export const bodySchema = stringField(1, 2000, "内容");

// 問い合わせ用の名前バリデーション
export const inquiryNameSchema = stringField(1, 16, "名前");

export const consentStatusSchema = z.enum(["pending", "approved", "rejected"]);
