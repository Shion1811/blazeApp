// サーバー起動
import "dotenv/config";
import { serve } from "@hono/node-server";
import { app, cleanupExpiredAccounts } from "./app.js";

// サーバー起動時と1時間ごとにクリーンアップ実行
void cleanupExpiredAccounts();
setInterval(() => { void cleanupExpiredAccounts(); }, 60 * 60 * 1000);

const port = Number(process.env.PORT) || 8080;

console.log(`サーバー起動中... ポート: ${port}`);

serve(
  { fetch: app.fetch, port },
  (info) => {
    console.log(`サーバー起動完了: http://localhost:${info.port}`);
  },
);
