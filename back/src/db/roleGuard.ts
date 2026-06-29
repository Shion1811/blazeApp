// ロールベースアクセス制御ミドルウェア
// authToken の後に使用する（c.get("user") が設定済みであること前提）

import type { Context, Next } from "hono";
import type { admin } from "./schema.js";

type User = typeof admin.$inferSelect;
type Role = "owner" | "admin" | "member";

function requireRole(...allowedRoles: Role[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as User | undefined;
    if (!user || !allowedRoles.includes(user.role as Role)) {
      return c.json(
        { success: false, errors: "この操作を行う権限がありません。" },
        403,
      );
    }
    await next();
  };
}

// owner のみ
export const requireOwner = requireRole("owner");

// admin または owner
export const requireAdmin = requireRole("owner", "admin");
