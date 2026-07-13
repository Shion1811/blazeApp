// テスト全体で1回だけDBマイグレーションを実行

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const TEST_DB_URL =
  process.env.DATABASE_URL ?? "postgres://test:test@localhost:5433/test_db";

export async function setup() {
  const pool = new pg.Pool({ connectionString: TEST_DB_URL, ssl: false });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
}
