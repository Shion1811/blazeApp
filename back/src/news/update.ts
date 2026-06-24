// PATCH /api/news-post/:id（または /api/media/:id） — 編集（管理者のみ）

import { z, eq } from "../index.js";
import {
  db,
  news,
  titleSchema,
  bodySchema,
  sanitizeHtml,
  replaceMediaOnS3,
} from "../shared/index.js";
import type { Context } from "hono";

export function createUpdate(type: "news" | "media", label: string, s3Prefix: string) {
  return async (c: Context) => {
    const id = c.req.param("id");
    if (!id) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

    const existing = await db.select().from(news).where(eq(news.id, id));
    if (existing.length === 0 || existing[0]!.type !== type) {
      return c.json({ success: false, errors: `${label}が見つかりません。` }, 404);
    }

    const body = await c.req.parseBody();

    const schema = z.object({
      title: titleSchema.optional(),
      body: bodySchema.optional(),
    });

    const result = schema.safeParse({
      title: body["title"] || undefined,
      body: body["body"] || undefined,
    });

    if (!result.success) {
      return c.json(
        {
          success: false,
          errors: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      );
    }

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (result.data.title) updateData.title = sanitizeHtml(result.data.title);
    if (result.data.body) updateData.body = sanitizeHtml(result.data.body);

    // 新しい画像がアップロードされた場合は差し替え
    const imageFile = body["image"];
    if (imageFile && imageFile instanceof File) {
      const imageResult = await replaceMediaOnS3(
        existing[0]!.img,
        imageFile,
        `${s3Prefix}/${id}`,
        "image",
      );
      if (!imageResult.success) {
        return c.json({ success: false, errors: imageResult.error }, imageResult.status);
      }
      updateData.img = imageResult.path;
    }

    const updated = await db.update(news).set(updateData).where(eq(news.id, id)).returning();

    return c.json({ success: true, message: `${label}を更新しました。`, data: updated[0] }, 200);
  };
}
