import { eq } from "../index.js";
import {
  db,
  achievement,
  images,
  movies,
  files,
  toMediaUrl,
  getRelatedMediaUrls,
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

  // 関連するimg/movie/fileを取得してURLに変換
  const imageUrls = await getRelatedMediaUrls(images, images.achievement_id, id);
  const movieUrls = await getRelatedMediaUrls(movies, movies.achievement_id, id);
  const fileUrls = await getRelatedMediaUrls(files, files.achievement_id, id);

  return c.json(
    {
      success: true,
      data: {
        ...item,
        img_url: await toMediaUrl(item.img),
        movie_url: await toMediaUrl(item.movie),
        file_url: await toMediaUrl(item.file),
        images: imageUrls,
        movies: movieUrls,
        files: fileUrls,
      },
    },
    200,
  );
};
