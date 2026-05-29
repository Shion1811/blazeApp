// トークン認証ミドルウェア（共通）

import { eq } from "drizzle-orm";
import { db } from "./index.js";
import { admin } from "./schema.js";
import type { Context, Next } from "hono";

// Honoのミドルウェアとして定義（引数にc, nextを受け取る）
export async function authToken(c: Context, next: Next) {
  // Authorizationヘッダーからトークンを取得
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { success: false, errors: "認証トークンがありません。" },
      401,
    );
  }

  // "Bearer xxxxx" の7文字目以降を取得し空のtokenは401エラーを出す
  const token = authHeader.slice(7).trim();
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

  const oneMOnthKeep = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (user.token_issued_at < oneMOnthKeep) {
    return c.json(
      { success: false, errors: "トークンの有効期限が切れています。" },
      401,
    );
  }

  //データを渡せるようにしてる
  c.set("user", user);
  await next();
}
