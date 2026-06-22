import { eq } from "../index.js";
import {
  db,
  achievement,
  images,
  movies,
  files,
  deleteFromS3,
  deleteMediaFromS3,
} from "../shared/index.js";

import type { Context } from "hono";

export const remove = async (c: Context) => {
  const id = c.req.param("id");

  if (!id) {
    return c.json(
      { success: false, errors: "実績IDが指定されていません。" },
      400,
    );
  }

  const existing = await db
    .select()
    .from(achievement)
    .where(eq(achievement.id, id));

  if (existing.length === 0) {
    return c.json({ success: false, errors: "実績が見つかりません。" }, 404);
  }

  const item = existing[0]!;

  // S3からメインのメディアを削除
  if (item.img) await deleteFromS3(item.img);
  if (item.movie) await deleteFromS3(item.movie);
  if (item.file) await deleteFromS3(item.file);

  // 関連する画像・動画・ファイルもS3から削除
  const relatedImages = await db
    .select()
    .from(images)
    .where(eq(images.achievement_id, id));
  await deleteMediaFromS3(relatedImages);

  const relatedMovies = await db
    .select()
    .from(movies)
    .where(eq(movies.achievement_id, id));
  await deleteMediaFromS3(relatedMovies);

  const relatedFiles = await db
    .select()
    .from(files)
    .where(eq(files.achievement_id, id));
  await deleteMediaFromS3(relatedFiles);

  // DBから削除（CASCADE設定で関連レコードも削除）
  await db.delete(achievement).where(eq(achievement.id, id));

  return c.json(
    {
      success: true,
      message: "実績を削除しました。",
    },
    200,
  );
};
