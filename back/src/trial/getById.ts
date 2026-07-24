// GET /api/trial-application/:id — 特定の体験申し込み内容を取得（管理者のみ）

import { eq } from "../index.js";
import { db, trialApplication } from "../shared/index.js";
import type { Context } from "hono";

export const getById = async (c: Context) => {
  const id = c.req.param("id");
  if (!id) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

  const result = await db.select().from(trialApplication).where(eq(trialApplication.id, id));
  const item = result[0];

  if (!item) return c.json({ success: false, errors: "体験申し込みが見つかりません。" }, 404);

  return c.json({ success: true, data: item }, 200);
};
