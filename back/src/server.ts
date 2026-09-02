// サーバー起動
import "dotenv/config";
import { serve } from "@hono/node-server";
import { app, cleanupExpiredAccounts } from "./app.js";
import { runMigrations } from "./db/migrate.js";

const port = Number(process.env.PORT) || 8080;

async function main() {
  // サーバーを起動する前に、未適用のマイグレーションを自動で適用する。
  // 失敗した場合はスキーマ不整合のまま稼働させないよう、起動自体を中断する。
  await runMigrations();

  // サーバー起動時と1時間ごとにクリーンアップ実行
  void cleanupExpiredAccounts();
  setInterval(() => { void cleanupExpiredAccounts(); }, 60 * 60 * 1000);

  console.log(`サーバー起動中... ポート: ${port}`);

  serve(
    { fetch: app.fetch, port },
    (info) => {
      console.log(`サーバー起動完了: http://localhost:${info.port}`);
    },
  );
}

void main().catch((err) => {
  console.error("サーバー起動に失敗しました:", err);
  process.exit(1);
});
