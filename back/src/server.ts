// サーバー起動
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import registerApp from "./admin/register.js";
import loginApp from "./admin/login.js";
import logoutApp from "./admin/logout.js";

const app = new Hono();

// ルートの登録
app.route("/", registerApp);
app.route("/", loginApp);
app.route("/", logoutApp);

// サーバー起動
const port = Number(process.env.PORT) || 3000;

console.log(`サーバー起動中... ポート: ${port}`);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`サーバー起動完了: http://localhost:${info.port}`);
  },
);
