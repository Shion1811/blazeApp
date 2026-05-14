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
    // 本番: 証明書を検証（安全） / 開発: 検証をスキップ
    ssl: { rejectUnauthorized: process.env.NODE_ENV === "production" },
  },
});
