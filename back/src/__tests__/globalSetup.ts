// vitest globalSetup — テスト全体で1回だけ実行
// マイグレーション適用 → テスト後にコンテナ接続を閉じる

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_URL = process.env.DATABASE_URL ?? "postgres://test:test@localhost:5433/test_db";

export async function setup() {
  const pool = new pg.Pool({ connectionString: TEST_DB_URL, ssl: false });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: join(__dirname, "../../drizzle") });
  await pool.end();
}
