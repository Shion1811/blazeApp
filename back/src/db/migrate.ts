// 起動時に未適用のマイグレーションを自動で適用し、適用内容をログに残す

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";
import type { PoolClient } from "pg";
import { db, pool } from "./index.js";

// dist/db/migrate.js（開発時は src/db/migrate.ts）から見た drizzle フォルダ。
// どちらも2階層下にあるため相対パスは同じで解決できる。
const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

// マイグレーション専用のアドバイザリロックキー。
// ローリングデプロイ等で複数タスクが同時起動しても、
// 同時にマイグレーションが走って競合しないよう排他制御に使う。
const MIGRATION_LOCK_KEY = 4966574;

type JournalEntry = { idx: number; when: number; tag: string };

// _journal.json から全マイグレーションの一覧（when と tag の対応）を読む
function readJournal(): JournalEntry[] {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: JournalEntry[];
  };
  return journal.entries;
}

// 既にDBへ適用済みのマイグレーションの created_at(= journal の when) を取得する。
// 初回はテーブルが存在しないため空集合を返す（＝すべて未適用扱い）。
async function getAppliedWhen(client: PoolClient): Promise<Set<number>> {
  try {
    const result = await client.query<{ created_at: string }>(
      "SELECT created_at FROM drizzle.__drizzle_migrations",
    );
    return new Set(result.rows.map((r) => Number(r.created_at)));
  } catch {
    return new Set();
  }
}

export async function runMigrations(): Promise<void> {
  const started = Date.now();
  const entries = readJournal();
  const client = await pool.connect();
  try {
    // 排他ロックを取得（他タスクが実行中ならここで待機する）
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);

    const appliedBefore = await getAppliedWhen(client);
    const pending = entries.filter((e) => !appliedBefore.has(e.when));

    if (pending.length === 0) {
      console.log(
        "[migrate] 適用が必要なマイグレーションはありません（DBは最新です）",
      );
      return;
    }

    console.log(
      `[migrate] 未適用のマイグレーション ${pending.length} 件を適用します: ${pending
        .map((e) => e.tag)
        .join(", ")}`,
    );

    await migrate(db, { migrationsFolder });

    for (const e of pending) {
      console.log(`[migrate] 適用完了: ${e.tag}`);
    }
    console.log(
      `[migrate] 全 ${pending.length} 件のマイグレーションを適用しました (${
        Date.now() - started
      }ms)`,
    );
  } catch (err) {
    console.error("[migrate] マイグレーションに失敗しました:", err);
    throw err;
  } finally {
    // ロックは必ず解放し、コネクションをプールへ返す
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    client.release();
  }
}
