// 他者アカウント削除（owner合意制）
// POST   /api/admin/users/:userId/delete-request         — 削除リクエスト作成
// GET    /api/admin/delete-requests                      — 承認待ちリスト
// POST   /api/admin/delete-requests/:requestId/approve   — 承認
// DELETE /api/admin/delete-requests/:requestId           — キャンセル

import { Hono, eq, and } from "../index.js";
import { isNull, isNotNull } from "drizzle-orm";
import { db, admin, authToken } from "../shared/index.js";
import { deletionRequests, deletionApprovals } from "../db/schema.js";
import { requireOwner } from "../db/roleGuard.js";

type Variables = { user: typeof admin.$inferSelect };

const app = new Hono<{ Variables: Variables }>();

// 全ownerが承認済みか確認し、済みなら対象ユーザーをソフトデリートして実行
async function tryExecuteDeletion(requestId: string): Promise<boolean> {
  const reqs = await db
    .select()
    .from(deletionRequests)
    .where(eq(deletionRequests.id, requestId));

  const req = reqs[0];
  if (!req) return false;
  if (req.expires_at < new Date()) return false;

  // 対象ユーザーが既に削除済みなら終了
  const targets = await db
    .select()
    .from(admin)
    .where(eq(admin.id, req.target_user_id));
  const target = targets[0];
  if (!target || target.deleted_at) return false;

  // 非targetの全activeオーナーを取得
  const allUsers = await db.select().from(admin).where(isNull(admin.deleted_at));
  const activeOwners = allUsers.filter(
    (u) => u.role === "owner" && u.id !== req.target_user_id,
  );

  // 承認数を取得
  const approvals = await db
    .select()
    .from(deletionApprovals)
    .where(eq(deletionApprovals.request_id, requestId));

  const approvedIds = new Set(approvals.map((a) => a.approved_by));
  const allApproved = activeOwners.every((o) => approvedIds.has(o.id));
  if (!allApproved) return false;

  // 全員承認 → ソフトデリート実行
  await db
    .update(admin)
    .set({ token: null, deleted_at: new Date() })
    .where(eq(admin.id, req.target_user_id));

  // リクエスト削除（cascadeでapprovalsも消える）
  await db
    .delete(deletionRequests)
    .where(eq(deletionRequests.id, requestId));

  return true;
}

// 削除リクエスト作成
app.post("/api/admin/users/:userId/delete-request", authToken, requireOwner, async (c) => {
  const targetId = c.req.param("userId");
  if (!targetId) {
    return c.json({ success: false, errors: "ユーザーIDが指定されていません。" }, 400);
  }

  const me = c.get("user");
  if (targetId === me.id) {
    return c.json(
      { success: false, errors: "自分自身の削除はアカウント削除エンドポイントを使用してください。" },
      400,
    );
  }

  // 対象ユーザーの存在確認
  const targets = await db
    .select()
    .from(admin)
    .where(and(eq(admin.id, targetId), isNull(admin.deleted_at)));
  if (!targets[0]) {
    return c.json({ success: false, errors: "ユーザーが見つかりません。" }, 404);
  }

  // 有効な既存リクエストの確認
  const existing = await db
    .select()
    .from(deletionRequests)
    .where(eq(deletionRequests.target_user_id, targetId));
  const activeExisting = existing.filter((r) => r.expires_at > new Date());
  if (activeExisting.length > 0) {
    return c.json(
      { success: false, errors: "このユーザーへの削除リクエストが既に存在します。" },
      409,
    );
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const inserted = await db
    .insert(deletionRequests)
    .values({ target_user_id: targetId, requested_by: me.id, expires_at: expiresAt })
    .returning();

  const newReqId = inserted[0]?.id;
  if (!newReqId) {
    return c.json({ success: false, errors: "リクエストの作成に失敗しました。" }, 500);
  }

  // リクエスト者を自動承認
  await db
    .insert(deletionApprovals)
    .values({ request_id: newReqId, approved_by: me.id });

  // 他にownerがいなければ即実行
  const executed = await tryExecuteDeletion(newReqId);
  if (executed) {
    return c.json(
      { success: true, message: "他にownerがいないためアカウントを削除しました。" },
      200,
    );
  }

  return c.json(
    {
      success: true,
      message: "削除リクエストを作成しました。他のownerの承認が必要です。",
      data: { request_id: newReqId, expires_at: expiresAt },
    },
    200,
  );
});

// 承認待ちリスト取得
app.get("/api/admin/delete-requests", authToken, requireOwner, async (c) => {
  const now = new Date();
  const requests = await db
    .select()
    .from(deletionRequests)
    .where(isNotNull(deletionRequests.id));

  const active = requests.filter((r) => r.expires_at > now);
  return c.json({ success: true, total: active.length, data: active }, 200);
});

// 承認
app.post("/api/admin/delete-requests/:requestId/approve", authToken, requireOwner, async (c) => {
  const requestId = c.req.param("requestId");
  if (!requestId) {
    return c.json({ success: false, errors: "リクエストIDが指定されていません。" }, 400);
  }

  const me = c.get("user");

  const reqs = await db
    .select()
    .from(deletionRequests)
    .where(eq(deletionRequests.id, requestId));
  const req = reqs[0];
  if (!req) {
    return c.json({ success: false, errors: "削除リクエストが見つかりません。" }, 404);
  }
  if (req.expires_at < new Date()) {
    return c.json({ success: false, errors: "削除リクエストの有効期限が切れています。" }, 410);
  }

  // 重複承認チェック
  const existing = await db
    .select()
    .from(deletionApprovals)
    .where(
      and(
        eq(deletionApprovals.request_id, requestId),
        eq(deletionApprovals.approved_by, me.id),
      ),
    );
  if (existing.length > 0) {
    return c.json({ success: false, errors: "既に承認済みです。" }, 409);
  }

  await db
    .insert(deletionApprovals)
    .values({ request_id: requestId, approved_by: me.id });

  const executed = await tryExecuteDeletion(requestId);
  if (executed) {
    return c.json(
      { success: true, message: "全ownerが承認したためアカウントを削除しました。" },
      200,
    );
  }

  return c.json(
    { success: true, message: "承認しました。他のownerの承認を待っています。" },
    200,
  );
});

// リクエストキャンセル
app.delete("/api/admin/delete-requests/:requestId", authToken, requireOwner, async (c) => {
  const requestId = c.req.param("requestId");
  if (!requestId) {
    return c.json({ success: false, errors: "リクエストIDが指定されていません。" }, 400);
  }

  const reqs = await db
    .select()
    .from(deletionRequests)
    .where(eq(deletionRequests.id, requestId));
  if (!reqs[0]) {
    return c.json({ success: false, errors: "削除リクエストが見つかりません。" }, 404);
  }

  await db
    .delete(deletionRequests)
    .where(eq(deletionRequests.id, requestId));

  return c.json({ success: true, message: "削除リクエストをキャンセルしました。" }, 200);
});

export default app;
