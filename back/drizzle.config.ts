// スキーマを参照しマイグレーション実行するためのファイル
// npx drizzle-kit generate → スキーマからSQLを自動生成
// npx drizzle-kit migrate → 実際にDBに反映

import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  //   スキーマの参照場所
  schema: "./src/db/schema.ts",
  //   マイグレーションファイルの出力先
  out: "./drizzle",
  //   どのdbを使用するか選択
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    // ローカル環境ではssl認証をスキップし本番ではssl認証を行う
    // 本番環境ではenvにNODE_ENV=productionを追記する
    ...(process.env.NODE_ENV === "production" && {
      ssl: { rejectUnauthorized: true },
    }),
  },
});
