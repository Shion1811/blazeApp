import { Hono } from "../index.js";
import { admin, authToken } from "../shared/index.js";

// c.get("user") で使う型を宣言
type Variables = {
  user: typeof admin.$inferSelect;
};

const app = new Hono<{ Variables: Variables }>();

// ログイン中のユーザー情報を返す（front側のログイン判定用）
app.get("/api/admin/me", authToken, (c) => {
  const user = c.get("user");

  return c.json(
    {
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
    200,
  );
});

export default app;
