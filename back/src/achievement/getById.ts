import { eq } from "../index.js";
import {
  db,
  achievement,
  images,
  movies,
  files,
  getPresignedDownloadUrl,
} from "../shared/index.js";

import type { Context } from "hono";

export const getById = async (c: Context) => {
  // idを取得
  // paramはURLパラメータの動的なものをを取得
  const id = c.req.param("id");

  if (!id) {
    return c.json({ success: false, errors: "IDが指定されていません。" }, 404);
  }

  const result = await db
    .select()
    .from(achievement)
    // 取得したid内の情報を取得
    .where(eq(achievement.id, id));
  const item = result[0];

  if (!item) {
    return c.json({ success: false, errors: "実績が見つかりません。" }, 404);
  }

  //imgの取得
  const relatedImages = await db
    .select()
    .from(images)
    .where(eq(images.achievement_id, id));

  // movieの取得
  const relatedMovies = await db
    .select()
    .from(movies)
    .where(eq(movies.achievement_id, id));

  // fileの取得
  const relatedFiles = await db
    .select()
    .from(files)
    .where(eq(files.achievement_id, id));

  // 取得したimgをURLに変換
  const imageUrls = await Promise.all(
    relatedImages.map(async (img) => ({
      id: img.id,
      url: await getPresignedDownloadUrl(img.path),
    })),
  );

  // 取得したmovieをURLに変換
  const movieUrls = await Promise.all(
    relatedMovies.map(async (mov) => ({
      id: mov.id,
      url: await getPresignedDownloadUrl(mov.path),
    })),
  );

  // 取得したfileをURLに変換
  const fileUrls = await Promise.all(
    relatedFiles.map(async (f) => ({
      id: f.id,
      url: await getPresignedDownloadUrl(f.path),
    })),
  );

  return c.json(
    {
      success: true,
      data: {
        ...item,
        img_url: item.img ? await getPresignedDownloadUrl(item.img) : null,
        movie_url: item.movie
          ? await getPresignedDownloadUrl(item.movie)
          : null,
        file_url: item.file ? await getPresignedDownloadUrl(item.file) : null,
        images: imageUrls,
        movies: movieUrls,
        files: fileUrls,
      },
    },
    200,
  );
};
