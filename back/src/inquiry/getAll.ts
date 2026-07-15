// GET /api/inquiry — 全ての問い合わせを取得（管理者のみ）

import { desc } from "../index.js";
import { count } from "drizzle-orm";
import { db, inquiry, toMediaUrl, parsePage, buildPagination } from "../shared/index.js";
import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const { page, limit, offset } = parsePage(c);

  const [allInquiries, totalResult] = await Promise.all([
    db
      .select()
      .from(inquiry)
      .orderBy(desc(inquiry.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(inquiry),
  ]);
  const total = Number(totalResult[0]?.total ?? 0);

  // 画像の署名付きURLを付与
  const inquiriesWithUrls = await Promise.all(
    allInquiries.map(async (item) => ({
      ...item,
      img_url: await toMediaUrl(item.img),
    })),
  );

  return c.json(
    {
      success: true,
      data: inquiriesWithUrls,
      pagination: buildPagination(page, limit, total),
    },
    200,
  );
};
