// トークン認証ミドルウェア（共通）

import { getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { db } from "./index.js";
import { admin } from "./schema.js";
import type { Context, Next } from "hono";

// Honoのミドルウェアとして定義（引数にc, nextを受け取る）
export async function authToken(c: Context, next: Next) {
  // HttpOnly Cookieからトークンを取得
  const token = getCookie(c, "token");

  if (!token) {
    return c.json(
      { success: false, errors: "認証トークンがありません。" },
      401,
    );
  }

  // トークンでユーザーを検索
  const existingUsers = await db
    .select()
    .from(admin)
    .where(eq(admin.token, token));

  const user = existingUsers[0];
  if (!user) {
    return c.json({ success: false, errors: "無効なトークンです。" }, 401);
  }

  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (user.token_issued_at < oneMonthAgo) {
    return c.json(
      { success: false, errors: "トークンの有効期限が切れています。" },
      401,
    );
  }

  // データを渡せるようにしてる
  c.set("user", user);
  await next();
}
