import { Hono, z, eq, bcrypt } from "../index.js";
import { db, admin, passwordBaseSchema, authToken } from "../shared/index.js";

type Variables = {
  user: typeof admin.$inferSelect;
};

const app = new Hono<{ Variables: Variables }>();

app.post("/api/admin/account-delete", authToken, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, errors: "リクエストのJSON形式が不正です" },
      400,
    );
  }

  // パスワードの再確認用スキーマ
  const deleteSchema = z.object({
    password: passwordBaseSchema,
  });

  const result = deleteSchema.safeParse(body);
  if (!result.success) {
    return c.json({ success: false, errors: result.error }, 400);
  }

  // authTokenで検証済みのユーザーを取得
  const user = c.get("user");

  // パスワード照合（本人確認）
  const isPasswordValid = await bcrypt.compare(
    result.data.password,
    user.password,
  );
  if (!isPasswordValid) {
    return c.json(
      { success: false, errors: "パスワードが正しくありません。" },
      401,
    );
  }

  // DBからユーザーを削除
  await db.delete(admin).where(eq(admin.id, user.id));

  // 成功
  return c.json(
    {
      success: true,
      message: "アカウントを削除しました",
    },
    200,
  );
});

export default app;
