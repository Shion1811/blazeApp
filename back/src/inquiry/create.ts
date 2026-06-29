// POST /api/inquiry — お客様からの問い合わせ（認証不要・レートリミットあり）

import { z } from "../index.js";
import {
  db,
  inquiry,
  inquiryNameSchema,
  titleSchema,
  bodySchema,
  processImageUpload,
} from "../shared/index.js";
import type { Context } from "hono";

export const create = async (c: Context) => {
  const body = await c.req.parseBody();

  const schema = z.object({
    name: inquiryNameSchema,
    title: titleSchema,
    body: bodySchema,
  });

  const result = schema.safeParse({
    name: body["name"],
    title: body["title"],
    body: body["body"],
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

  const name = result.data.name;
  const title = result.data.title;
  const bodyText = result.data.body;

  // 画像の処理（任意）
  let imgPath: string | null = null;
  const imageFile = body["image"];

  if (imageFile && imageFile instanceof File) {
    const tempId = crypto.randomUUID();
    const imageResult = await processImageUpload(imageFile, `inquiry/${tempId}`);
    if (!imageResult.success) {
      return c.json({ success: false, errors: imageResult.error }, imageResult.status);
    }
    imgPath = imageResult.path;
  }

  const inserted = await db
    .insert(inquiry)
    .values({ name, title, body: bodyText, img: imgPath })
    .returning();

  return c.json({ success: true, message: "問い合わせを送信しました。", data: inserted[0] }, 200);
};
