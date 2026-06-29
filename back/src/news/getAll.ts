// GET /api/news-post（または /api/media） — 一覧取得

import { eq, desc } from "../index.js";
import { db, news, toMediaUrl } from "../shared/index.js";
import type { Context } from "hono";

export function createGetAll(type: "news" | "media") {
  return async (c: Context) => {
    const all = await db
      .select()
      .from(news)
      .where(eq(news.type, type))
      .orderBy(desc(news.created_at));

    const withUrls = await Promise.all(
      all.map(async (item) => ({
        ...item,
        img_url: await toMediaUrl(item.img),
      })),
    );

    return c.json({ success: true, total: withUrls.length, data: withUrls }, 200);
  };
}
