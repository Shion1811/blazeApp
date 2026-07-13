// GET /api/news-post（または /api/media） — 一覧取得

import { eq, desc } from "../index.js";
import { count, getTableColumns } from "drizzle-orm";
import { db, news, admin, toMediaUrl, parsePage, buildPagination } from "../shared/index.js";
import type { Context } from "hono";

export function createGetAll(type: "news" | "media") {
  return async (c: Context) => {
    const { page, limit, offset } = parsePage(c);

    const [all, totalResult] = await Promise.all([
      db
        .select({
          ...getTableColumns(news),
          admin_name: admin.name,
        })
        .from(news)
        .leftJoin(admin, eq(news.admin_id, admin.id))
        .where(eq(news.type, type))
        .orderBy(desc(news.created_at))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(news).where(eq(news.type, type)),
    ]);
    const total = totalResult[0]?.total ?? 0;

    const withUrls = await Promise.all(
      all.map(async (item) => ({
        ...item,
        admin_name: item.admin_name ?? "元管理者",
        img_url: await toMediaUrl(item.img),
      })),
    );

    return c.json(
      {
        success: true,
        data: withUrls,
        pagination: buildPagination(page, limit, total),
      },
      200,
    );
  };
}
