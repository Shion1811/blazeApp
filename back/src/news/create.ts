// POST /api/news-post（または /api/media） — 新規投稿（管理者のみ）

import { z } from "../index.js";
import {
  db,
  news,
  titleSchema,
  bodySchema,
  categorySchema,
  processImageUpload,
} from "../shared/index.js";
import type { Context } from "hono";

export function createCreate(type: "news" | "media", label: string, s3Prefix: string) {
  return async (c: Context) => {
    const user = c.get("user") as { id: string };
    const body = await c.req.parseBody();

    const schema = z.object({ title: titleSchema, body: bodySchema, category: categorySchema.optional() });
    const result = schema.safeParse({
      title: body["title"],
      body: body["body"],
      category: body["category"] || undefined,
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

    const title = result.data.title;
    const bodyText = result.data.body;

    // 画像の処理（任意）
    let imgPath: string | null = null;
    const imageFile = body["image"];

    if (imageFile && imageFile instanceof File) {
      const tempId = crypto.randomUUID();
      const imageResult = await processImageUpload(imageFile, `${s3Prefix}/${tempId}`);
      if (!imageResult.success) {
        return c.json({ success: false, errors: imageResult.error }, imageResult.status);
      }
      imgPath = imageResult.path;
    }

    const inserted = await db
      .insert(news)
      .values({
        title,
        body: bodyText,
        img: imgPath,
        type,
        admin_id: user.id,
        category: result.data.category ?? null,
      })
      .returning();

    return c.json({ success: true, message: `${label}を投稿しました。`, data: inserted[0] }, 200);
  };
}
