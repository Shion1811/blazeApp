import { Hono, eq } from "../index.js";
import { db } from "../db/index.js";
import { admin } from "../db/schema.js";

const app = new Hono();

app.post("/api/admin/logout", async (c) => {
  // Authorizationヘッダーからトークンを取得
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { success: false, errors: "認証トークンがありません。" },
      401,
    );
  }

  // トークンの7文字目以降を取得
  const token = authHeader.slice(7);

  // トークンでユーザーを検索
  const existingUsers = await db
    .select()
    .from(admin)
    .where(eq(admin.token, token));

  const user = existingUsers[0];
  if (!user) {
    return c.json({ success: false, errors: "無効なトークンです。" }, 401);
  }

  // トークンを削除（ログアウト処理）
  await db.update(admin).set({ token: null }).where(eq(admin.id, user.id));

  // 成功
  return c.json(
    {
      success: true,
      message: "ログアウト成功",
    },
    200,
  );
});

export default app;
