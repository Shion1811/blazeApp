import { eq } from "../index.js";
import { getTableColumns } from "drizzle-orm";
import {
  db,
  achievement,
  admin,
  images,
  movies,
  files,
  toMediaUrl,
  getRelatedMediaUrls,
} from "../shared/index.js";
import type { Context } from "hono";

export const getById = async (c: Context) => {
  const id = c.req.param("id");

  if (!id) {
    return c.json({ success: false, errors: "IDが指定されていません。" }, 404);
  }

  const result = await db
    .select({
      ...getTableColumns(achievement),
      admin_name: admin.name,
    })
    .from(achievement)
    .leftJoin(admin, eq(achievement.admin_id, admin.id))
    .where(eq(achievement.id, id));

  const item = result[0];

  if (!item) {
    return c.json({ success: false, errors: "実績が見つかりません。" }, 404);
  }

  return c.json(
    {
      success: true,
      data: {
        ...item,
        admin_name: item.admin_name ?? "元管理者",
        img_url: await toMediaUrl(item.img),
        movie_url: await toMediaUrl(item.movie),
        file_url: await toMediaUrl(item.file),
        images: await getRelatedMediaUrls(images, images.achievement_id, id),
        movies: await getRelatedMediaUrls(movies, movies.achievement_id, id),
        files: await getRelatedMediaUrls(files, files.achievement_id, id),
      },
    },
    200,
  );
};
