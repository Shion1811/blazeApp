// DBと接続

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("接続に失敗しました。");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 本番: 証明書を検証（安全） / 開発: 検証をスキップ
  // 本番環境ではenvにNODE_ENV=productionを追記する
  ssl: { rejectUnauthorized: process.env.NODE_ENV === "production" },
});

export const db = drizzle(pool);
