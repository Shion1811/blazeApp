// DELETE /api/news-post/:id（または /api/media/:id） — 削除（管理者のみ）

import { eq } from "../index.js";
import { db, news, images, deleteFromS3, deleteMediaFromS3 } from "../shared/index.js";
import type { Context } from "hono";

export function createRemove(type: "news" | "media", label: string) {
  return async (c: Context) => {
    const id = c.req.param("id");
    if (!id) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

    const existing = await db.select().from(news).where(eq(news.id, id));
    if (existing.length === 0 || existing[0]!.type !== type) {
      return c.json({ success: false, errors: `${label}が見つかりません。` }, 404);
    }

    // S3からメイン画像を削除
    if (existing[0]!.img) await deleteFromS3(existing[0]!.img);

    // 関連する画像もS3から削除
    const relatedImages = await db.select().from(images).where(eq(images.news_id, id));
    await deleteMediaFromS3(relatedImages);

    // DBから削除（CASCADE設定でimagesも自動削除）
    await db.delete(news).where(eq(news.id, id));

    return c.json({ success: true, message: `${label}を削除しました。` }, 200);
  };
}
