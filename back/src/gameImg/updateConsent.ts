// PATCH /api/gameImg/images/:imageId/consent — 画像の掲載同意ステータスを更新（管理者のみ）

import { eq } from "../index.js";
import { db, images, consentStatusSchema } from "../shared/index.js";
import type { Context } from "hono";

export const updateConsent = async (c: Context) => {
  const imageId = c.req.param("imageId");
  if (!imageId) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

  const existing = await db.select().from(images).where(eq(images.id, imageId));
  if (existing.length === 0) {
    return c.json({ success: false, errors: "画像が見つかりません。" }, 404);
  }

  if (!existing[0]!.game_id) {
    return c.json(
      { success: false, errors: "試合風景の画像のみ掲載同意を管理できます。" },
      400,
    );
  }

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const parsed = consentStatusSchema.safeParse(body.consent_status);
  if (!parsed.success) {
    return c.json(
      { success: false, errors: "consent_status は pending / approved / rejected のいずれかです。" },
      400,
    );
  }

  const updated = await db
    .update(images)
    .set({ consent_status: parsed.data })
    .where(eq(images.id, imageId))
    .returning();

  const labels: Record<string, string> = {
    pending: "未確認（掲載保留）",
    approved: "同意済み（掲載可）",
    rejected: "拒否（掲載不可）",
  };

  return c.json(
    {
      success: true,
      message: `掲載同意ステータスを「${labels[parsed.data]}」に更新しました。`,
      data: updated[0],
    },
    200,
  );
};
