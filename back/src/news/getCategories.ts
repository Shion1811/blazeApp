// GET /api/news-post/categories（または /api/media/categories） — 使用頻度上位5件のカテゴリーを取得
// 投稿フォームでのカテゴリー候補表示（デフォルト5件・そこから新規追加も可能）に使用

import { eq, and, desc } from "../index.js";
import { count, isNotNull } from "drizzle-orm";
import { db, news } from "../shared/index.js";
import type { Context } from "hono";

const TOP_CATEGORY_LIMIT = 5;

export function createGetCategories(type: "news" | "media") {
  return async (c: Context) => {
    const rows = await db
      .select({ category: news.category, count: count() })
      .from(news)
      .where(and(eq(news.type, type), isNotNull(news.category)))
      .groupBy(news.category)
      .orderBy(desc(count()))
      .limit(TOP_CATEGORY_LIMIT);

    return c.json(
      {
        success: true,
        data: rows.map((r) => ({ category: r.category as string, count: Number(r.count) })),
      },
      200,
    );
  };
}
