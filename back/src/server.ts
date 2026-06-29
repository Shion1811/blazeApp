// サーバー起動
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

// 管理者
import registerApp from "./admin/register.js";
import loginApp from "./admin/login.js";
import logoutApp from "./admin/logout.js";
import accountDeleteApp from "./admin/accountDelete.js";

// コンテンツ
import newsApp from "./news/index.js";
import inquiryApp from "./inquiry/index.js";
import achievementApp from "./achievement/index.js";
import gameImgApp from "./gameImg/index.js";
import mediaApp from "./media/index.js";

const app = new Hono();

// CORS設定（フロントエンドとの通信に必要）
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      // デプロイ時に本番のURLを追加する
    ],
    credentials: true, // Cookie送信に必要
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// コンテンツルーティング
app.route("/", registerApp);
app.route("/", loginApp);
app.route("/", logoutApp);
app.route("/", accountDeleteApp);
app.route("/", newsApp);
app.route("/", inquiryApp);
app.route("/", achievementApp);
app.route("/", gameImgApp);
app.route("/", mediaApp);

// サーバー起動
const port = Number(process.env.PORT) || 8080;

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
