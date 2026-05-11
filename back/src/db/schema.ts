// スキーマ設計

import { pgTable, uuid, varchar, timestamp } from "../index.js";

export const users = pgTable("users", {
  // idの生成
  id: uuid("id").defaultRandom().primaryKey(),
  //   lengthは100文字以内 notNullで空文字は不可
  name: varchar("name", { length: 100 }).notNull(),
  // uniqueは重複を不可
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  token: varchar("token", { length: 64 }),
  // timestampで作成時の現在時刻を取得
  created_at: timestamp("created_at").defaultNow(),
});
