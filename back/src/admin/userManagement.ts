// ユーザー管理 API（owner専用）
// GET  /api/admin/users              — ユーザー一覧取得
// PATCH /api/admin/users/:userId/role — ロール変更

import { Hono, z, eq } from "../index.js";
import { isNull } from "drizzle-orm";
import { db, admin, authToken } from "../shared/index.js";
import { requireOwner } from "../db/roleGuard.js";

type Variables = { user: typeof admin.$inferSelect };

const app = new Hono<{ Variables: Variables }>();

// ユーザー一覧（削除済み除く）
app.get("/api/admin/users", authToken, requireOwner, async (c) => {
  const users = await db
    .select({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      created_at: admin.created_at,
    })
    .from(admin)
    .where(isNull(admin.deleted_at))
    .orderBy(admin.created_at);

  return c.json({ success: true, total: users.length, data: users }, 200);
});

// ロール変更
app.patch("/api/admin/users/:userId/role", authToken, requireOwner, async (c) => {
  const userId = c.req.param("userId");
  if (!userId) {
    return c.json({ success: false, errors: "ユーザーIDが指定されていません。" }, 400);
  }

  const me = c.get("user");
  if (userId === me.id) {
    return c.json(
      { success: false, errors: "自分自身のロールは変更できません。" },
      400,
    );
  }

  const roleSchema = z.object({
    role: z.enum(["owner", "admin", "member"]),
  });

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, errors: "リクエストのJSON形式が不正です" }, 400);
  }

  const result = roleSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      {
        success: false,
        errors: result.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      400,
    );
  }

  // 対象ユーザーの存在確認
  const targets = await db.select().from(admin).where(eq(admin.id, userId));
  const targetUser = targets[0];
  if (!targetUser || targetUser.deleted_at) {
    return c.json({ success: false, errors: "ユーザーが見つかりません。" }, 404);
  }

  // ownerが1人しかいない場合はdemotion禁止
  if (targetUser.role === "owner" && result.data.role !== "owner") {
    const allUsers = await db
      .select()
      .from(admin)
      .where(isNull(admin.deleted_at));
    const otherOwners = allUsers.filter(
      (u) => u.role === "owner" && u.id !== userId,
    );
    if (otherOwners.length === 0) {
      return c.json(
        {
          success: false,
          errors: "ownerが1人しかいないため、このユーザーのロールを変更できません。",
        },
        400,
      );
    }
  }

  await db.update(admin).set({ role: result.data.role }).where(eq(admin.id, userId));

  return c.json(
    { success: true, message: `ロールを ${result.data.role} に変更しました。` },
    200,
  );
});

export default app;
