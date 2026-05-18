// DBと接続

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("接続に失敗しました。");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ローカル環境ではssl認証をスキップし本番ではssl認証を行う
  // 本番環境ではenvにNODE_ENV=productionを追記する
  ...(process.env.NODE_ENV === "production" && {
    ssl: { rejectUnauthorized: true },
  }),
});

export const db = drizzle(pool);
