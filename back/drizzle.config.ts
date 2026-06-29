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
    // RDSは常にSSL接続が必要
    // 本番環境では証明書を厳格に検証、開発環境では暗号化のみ（db/index.tsと同じ設定）
    ssl: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  },
});
