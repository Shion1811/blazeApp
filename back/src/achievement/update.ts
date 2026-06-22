import { z, eq } from "../index.js";
import {
  db,
  achievement,
  titleSchema,
  bodySchema,
  sanitizeHtml,
  replaceMediaOnS3,
} from "../shared/index.js";

import type { Context } from "hono";

export const update = async (c: Context) => {
  const id = c.req.param("id");

  if (!id) {
    return c.json(
      { success: false, errors: "実績のIDが指定されていません。" },
      400,
    );
  }

  // idからdbに保存されてる情報を取得　なければ「実績が見つかりません。」と返す
  const existing = await db
    .select()
    .from(achievement)
    .where(eq(achievement.id, id));

  if (existing.length === 0) {
    return c.json({ success: false, errors: "実績が見つかりません。" }, 404);
  }

  const body = await c.req.parseBody();

  // スキーマ定義
  const schema = z.object({
    title: titleSchema.optional(),
    body: bodySchema.optional(),
  });

  // スキーマ検証
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

  // 編集された内容の保存し保存した日付も保存
  const updateData: Record<string, unknown> = {
    updated_at: new Date(),
  };
  if (result.data.title) updateData.title = sanitizeHtml(result.data.title);
  if (result.data.body) updateData.body = sanitizeHtml(result.data.body);

  const s3Prefix = `achievement/${id}`;

  // 画像の差し替え
  const imageFile = body["image"];
  if (imageFile && imageFile instanceof File) {
    const imageResult = await replaceMediaOnS3(
      existing[0]!.img,
      imageFile,
      s3Prefix,
      "image",
    );
    if (!imageResult.success) {
      return c.json(
        { success: false, errors: imageResult.error },
        imageResult.status,
      );
    }
    updateData.img = imageResult.path;
  }

  // 動画の差し替え
  const movieFile = body["movie"];
  if (movieFile && movieFile instanceof File) {
    const videoResult = await replaceMediaOnS3(
      existing[0]!.movie,
      movieFile,
      s3Prefix,
      "video",
    );
    if (!videoResult.success) {
      return c.json(
        { success: false, errors: videoResult.error },
        videoResult.status,
      );
    }
    updateData.movie = videoResult.path;
  }

  // ファイルの差し替え
  const fileUpload = body["file"];
  if (fileUpload && fileUpload instanceof File) {
    const fileResult = await replaceMediaOnS3(
      existing[0]!.file,
      fileUpload,
      s3Prefix,
      "file",
    );
    if (!fileResult.success) {
      return c.json(
        { success: false, errors: fileResult.error },
        fileResult.status,
      );
    }
    updateData.file = fileResult.path;
  }

  const updated = await db
    .update(achievement)
    .set(updateData)
    .where(eq(achievement.id, id))
    .returning();

  return c.json(
    {
      success: true,
      message: "実績を更新しました。",
      data: updated[0],
    },
    200,
  );
};
