// POST /api/inquiry/:id/reply — 問い合わせへの返信（管理者のみ）

import { z, eq } from "../index.js";
import {
  db,
  inquiry,
  reply,
  titleSchema,
  bodySchema,
  sanitizeHtml,
  processImageUpload,
  processFileUpload,
} from "../shared/index.js";
import type { Context } from "hono";

export const createReply = async (c: Context) => {
  const inquiryId = c.req.param("id");
  if (!inquiryId) {
    return c.json({ success: false, errors: "問い合わせIDが指定されていません。" }, 400);
  }

  const user = c.get("user") as { id: string };

  // 対象の問い合わせが存在するか確認
  const existing = await db.select().from(inquiry).where(eq(inquiry.id, inquiryId));
  if (existing.length === 0) {
    return c.json({ success: false, errors: "問い合わせが見つかりません。" }, 404);
  }

  const body = await c.req.parseBody();

  const schema = z.object({ title: titleSchema, body: bodySchema });
  const result = schema.safeParse({ title: body["title"], body: body["body"] });

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

  const title = sanitizeHtml(result.data.title);
  const bodyText = sanitizeHtml(result.data.body);

  // 画像の処理（任意）
  let imgPath: string | null = null;
  const imageFile = body["image"];

  if (imageFile && imageFile instanceof File) {
    const imageResult = await processImageUpload(imageFile, `reply/${inquiryId}`);
    if (!imageResult.success) {
      return c.json({ success: false, errors: imageResult.error }, imageResult.status);
    }
    imgPath = imageResult.path;
  }

  // ファイルの処理（任意）
  let filePath: string | null = null;
  const fileUpload = body["file"];

  if (fileUpload && fileUpload instanceof File) {
    const fileResult = await processFileUpload(fileUpload, `reply/${inquiryId}/files`);
    if (!fileResult.success) {
      return c.json({ success: false, errors: fileResult.error }, fileResult.status);
    }
    filePath = fileResult.path;
  }

  const inserted = await db
    .insert(reply)
    .values({
      inquiry_id: inquiryId,
      admin_id: user.id,
      title,
      body: bodyText,
      img: imgPath,
      file: filePath,
    })
    .returning();

  return c.json({ success: true, message: "返信を投稿しました。", data: inserted[0] }, 200);
};
