// PATCH /api/news-post/:id（または /api/media/:id） — 編集（管理者のみ）

import { z, eq } from "../index.js";
import {
  db,
  news,
  titleSchema,
  bodySchema,
  categorySchema,
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

    // categoryは「未送信=変更なし」と「空文字送信=カテゴリー削除」を区別する必要がある。
    // どちらも body["category"] || undefined にまとめてしまうと、削除が「変更なし」に
    // 化けて古い値が残り続けてしまう。
    const rawCategory = body["category"];
    const categoryProvided = typeof rawCategory === "string";
    const categoryCleared = categoryProvided && rawCategory.trim() === "";

    const schema = z.object({
      title: titleSchema.optional(),
      body: bodySchema.optional(),
      category: categorySchema.optional(),
    });

    const result = schema.safeParse({
      title: body["title"] || undefined,
      body: body["body"] || undefined,
      category: categoryProvided && !categoryCleared ? rawCategory : undefined,
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
    if (result.data.title) updateData.title = result.data.title;
    if (result.data.body) updateData.body = result.data.body;
    if (result.data.category) updateData.category = result.data.category;
    else if (categoryCleared) updateData.category = null;

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
