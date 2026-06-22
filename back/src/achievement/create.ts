import { z } from "../index.js";
import {
  db,
  achievement,
  titleSchema,
  bodySchema,
  sanitizeHtml,
  processImageUpload,
  processVideoUpload,
  processFileUpload,
} from "../shared/index.js";

import type { Context } from "hono";

export const create = async (c: Context) => {
  // admin_idから管理者のみを取得
  const user = c.get("user") as { id: string };
  // 普段jsonでデータを取得する時はjsonファイルでしか取得できないがparseBodyを使うことで画像やファイルなども取得することができる
  const body = await c.req.parseBody();

  // スキーマ定義
  const schema = z.object({
    title: titleSchema,
    body: bodySchema,
  });

  // スキーマ検証
  const result = schema.safeParse({
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

  const title = sanitizeHtml(result.data.title);
  const bodyText = sanitizeHtml(result.data.body);
  const tempId = crypto.randomUUID();
  const s3Prefix = `achievement/${tempId}`;

  // 画像の処理（任意）
  let imgPath: string | null = null;
  const imageFile = body["image"];

  if (imageFile && imageFile instanceof File) {
    const imageResult = await processImageUpload(imageFile, s3Prefix);
    if (!imageResult.success) {
      return c.json(
        { success: false, errors: imageResult.error },
        imageResult.status,
      );
    }
    imgPath = imageResult.path;
  }

  // 動画の処理（任意）
  let moviePath: string | null = null;
  const movieFile = body["movie"];

  if (movieFile && movieFile instanceof File) {
    const videoResult = await processVideoUpload(movieFile, s3Prefix);
    if (!videoResult.success) {
      return c.json(
        { success: false, errors: videoResult.error },
        videoResult.status,
      );
    }
    moviePath = videoResult.path;
  }

  // ファイルの処理（任意）
  let filePath: string | null = null;
  const fileUpload = body["file"];

  if (fileUpload && fileUpload instanceof File) {
    const fileResult = await processFileUpload(fileUpload, `${s3Prefix}/files`);
    if (!fileResult.success) {
      return c.json(
        { success: false, errors: fileResult.error },
        fileResult.status,
      );
    }
    filePath = fileResult.path;
  }

  // dbに新しい実績を保存する
  const inserted = await db
    .insert(achievement)
    .values({
      title,
      body: bodyText,
      img: imgPath,
      movie: moviePath,
      file: filePath,
      admin_id: user.id,
    })
    .returning();

  // フロントに「実績を投稿しました。」という文章で返す
  return c.json(
    {
      success: true,
      message: "実績を投稿しました。",
      data: inserted[0],
    },
    200,
  );
};
