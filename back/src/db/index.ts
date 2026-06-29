// DBと接続

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("接続に失敗しました。");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // テスト環境（ローカルDocker）はSSL非対応のため無効化
  // 本番環境では証明書を厳格に検証、開発環境では暗号化のみ
  ssl:
    process.env.NODE_ENV === "test"
      ? false
      : { rejectUnauthorized: process.env.NODE_ENV === "production" },
});

export const db = drizzle(pool);
