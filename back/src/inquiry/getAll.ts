// GET /api/inquiry — 全ての問い合わせを取得（管理者のみ）

import { desc } from "../index.js";
import { db, inquiry, toMediaUrl } from "../shared/index.js";
import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const allInquiries = await db
    .select()
    .from(inquiry)
    .orderBy(desc(inquiry.created_at));

  // 画像の署名付きURLを付与
  const inquiriesWithUrls = await Promise.all(
    allInquiries.map(async (item) => ({
      ...item,
      img_url: await toMediaUrl(item.img),
    })),
  );

  return c.json({ success: true, total: inquiriesWithUrls.length, data: inquiriesWithUrls }, 200);
};
