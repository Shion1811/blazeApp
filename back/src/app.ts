// Hono アプリ定義（テストから import できるよう serve() を含めない）

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";

// 管理者
import registerApp from "./admin/register.js";
import loginApp from "./admin/login.js";
import logoutApp from "./admin/logout.js";
import accountDeleteApp from "./admin/accountDelete.js";
import accountRecoverApp from "./admin/accountRecover.js";
import userManagementApp from "./admin/userManagement.js";
import deleteRequestApp from "./admin/deleteRequest.js";

// コンテンツ
import newsApp from "./news/index.js";
import inquiryApp from "./inquiry/index.js";
import achievementApp from "./achievement/index.js";
import gameImgApp from "./gameImg/index.js";
import mediaApp from "./media/index.js";

export const app = new Hono();

// アクセスログ（テスト時は NODE_ENV=test で抑制）
if (process.env.NODE_ENV !== "test") {
  app.use("*", logger());
}

// セキュリティヘッダー
app.use("*", secureHeaders());

// CORS
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
      : ["http://localhost:3000"],
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// ルーティング
app.route("/", registerApp);
app.route("/", loginApp);
app.route("/", logoutApp);
app.route("/", accountDeleteApp);
app.route("/", accountRecoverApp);
app.route("/", userManagementApp);
app.route("/", deleteRequestApp);
app.route("/", newsApp);
app.route("/", inquiryApp);
app.route("/", achievementApp);
app.route("/", gameImgApp);
app.route("/", mediaApp);

// 30日超過アカウントの完全削除
export const cleanupExpiredAccounts = async () => {
  try {
    await db.execute(sql`
      DELETE FROM users
      WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '30 days'
    `);
  } catch (e) {
    console.error("[cleanup] 削除済みアカウントのクリーンアップ失敗:", e);
  }
};
