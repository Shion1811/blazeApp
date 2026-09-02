// トークン認証ミドルウェア（共通）

import { getCookie } from "hono/cookie";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index.js";
import { admin } from "./schema.js";
import type { Context, Next } from "hono";
import { createHash } from "node:crypto";

type TokenLookupResult =
  | { status: "ok"; user: typeof admin.$inferSelect }
  | { status: "not_found" }
  | { status: "expired" };

export const hashToken = (token: string): string => 
  createHash("sha256").update(token).digest("hex");

// トークンで有効な（削除済みでない）ユーザーを検索し、期限切れかどうかも判定する
async function resolveUserFromToken(token: string): Promise<TokenLookupResult> {
  const hashedToken = hashToken(token);
  const existingUsers = await db
    .select()
    .from(admin)
    .where(and(eq(admin.token, hashedToken), isNull(admin.deleted_at)));

  const user = existingUsers[0];
  if (!user) return { status: "not_found" };

  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return user.token_issued_at >= oneMonthAgo
    ? { status: "ok", user }
    : { status: "expired" };
}

// 認証トークンがあればユーザーを返す（なければnull。認証不要のルートで使用）
export async function getOptionalUser(
  c: Context,
): Promise<typeof admin.$inferSelect | null> {
  const token = getCookie(c, "token");
  if (!token) return null;

  const result = await resolveUserFromToken(token);
  return result.status === "ok" ? result.user : null;
}

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

  const result = await resolveUserFromToken(token);

  if (result.status === "not_found") {
    return c.json({ success: false, errors: "無効なトークンです。" }, 401);
  }

  if (result.status === "expired") {
    return c.json(
      { success: false, errors: "トークンの有効期限が切れています。" },
      401,
    );
  }

  // データを渡せるようにしてる
  c.set("user", result.user);
  await next();
}
