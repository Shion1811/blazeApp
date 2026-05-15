// スキーマ設計

import { pgTable, uuid, varchar, timestamp, z } from "../index.js";

export const admin = pgTable("users", {
  // idの生成
  id: uuid("id").defaultRandom().primaryKey(),
  //   lengthは100文字以内 notNullで空文字は不可
  name: varchar("name", { length: 100 }).notNull(),
  // uniqueは重複を不可
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  token: varchar("token", { length: 64 }),
  // timestampで作成時の現在時刻を取得
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const emailSchema = z
  .email("メールアドレス形式が正しくありません。")
  .regex(/^[\x21-\x7e]+$/, "半角英数字・記号のみ使用できます")
  .refine((val) => val.split("@").length === 2, {
    message: "@は1つだけ使用してください",
  });

export const passwordBaseSchema = z
  .string()
  .min(8, "パスワードは8文字以上で入力してください。")
  .regex(/^[\x21-\x7e]+$/, "半角英数字・記号のみ使用できます。");
