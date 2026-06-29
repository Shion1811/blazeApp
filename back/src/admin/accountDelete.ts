import { Hono, z, eq, bcrypt } from "../index.js";
import { db, admin, passwordBaseSchema, authToken } from "../shared/index.js";

type Variables = {
  user: typeof admin.$inferSelect;
};

const app = new Hono<{ Variables: Variables }>();

app.delete("/api/admin/account-delete", authToken, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, errors: "リクエストのJSON形式が不正です" },
      400,
    );
  }

  const deleteSchema = z.object({
    password: passwordBaseSchema,
  });

  const result = deleteSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      {
        success: false,
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      400,
    );
  }

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

  // ソフトデリート：物理削除せず deleted_at をセット（30日以内は /api/admin/account-recover で復活可能）
  await db
    .update(admin)
    .set({ token: null, deleted_at: new Date() })
    .where(eq(admin.id, user.id));

  // Cookieも削除
  c.header(
    "Set-Cookie",
    "token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
  );

  return c.json(
    {
      success: true,
      message:
        "アカウントを削除しました。30日以内であれば復活できます。",
    },
    200,
  );
});

export default app;
