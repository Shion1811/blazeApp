// GET /api/news-post（または /api/media） — 一覧取得

import { eq, desc } from "../index.js";
import { getTableColumns } from "drizzle-orm";
import { db, news, admin, toMediaUrl } from "../shared/index.js";
import type { Context } from "hono";

export function createGetAll(type: "news" | "media") {
  return async (c: Context) => {
    const all = await db
      .select({
        ...getTableColumns(news),
        admin_name: admin.name,
      })
      .from(news)
      .leftJoin(admin, eq(news.admin_id, admin.id))
      .where(eq(news.type, type))
      .orderBy(desc(news.created_at));

    const withUrls = await Promise.all(
      all.map(async (item) => ({
        ...item,
        admin_name: item.admin_name ?? "元管理者",
        img_url: await toMediaUrl(item.img),
      })),
    );

    return c.json({ success: true, total: withUrls.length, data: withUrls }, 200);
  };
}
