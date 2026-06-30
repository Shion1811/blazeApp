// テスト共通ユーティリティ（マイグレーションは globalSetup.ts で実行済み）

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createClient } from "redis";

const TEST_DB_URL =
  process.env.DATABASE_URL ?? "postgres://test:test@localhost:5433/test_db";
const TEST_REDIS_URL =
  process.env.REDIS_URL ?? "redis://localhost:6380";

export const testPool = new pg.Pool({ connectionString: TEST_DB_URL, ssl: false });
export const testDb = drizzle(testPool);

const redisClient = createClient({ url: TEST_REDIS_URL });

// テーブルを全件削除 + Redis をフラッシュ（レートリミット状態をリセット）
export async function cleanDb() {
  // Redisフラッシュ（レートリミットキーを削除）
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  await redisClient.flushDb();

  // DBクリーンアップ
  await testPool.query(`
    TRUNCATE TABLE
      deletion_approvals,
      deletion_requests,
      reply,
      images,
      movies,
      files,
      news,
      achievement,
      game,
      inquiry,
      users
    RESTART IDENTITY CASCADE
  `);
}
