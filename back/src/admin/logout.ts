import { Hono, eq } from "../index.js";
import { db, admin, authToken } from "../shared/index.js";

// c.get("user") で使う型を宣言
type Variables = {
  // adminテーブルから自動で型を作成してくれる
  user: typeof admin.$inferSelect;
};

const app = new Hono<{ Variables: Variables }>();

app.post("/api/admin/logout", authToken, async (c) => {
  const user = c.get("user");

  // トークンを削除
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
