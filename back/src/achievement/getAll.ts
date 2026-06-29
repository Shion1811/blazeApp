import { desc, eq } from "../index.js";
import { getTableColumns } from "drizzle-orm";
import { db, achievement, admin, toMediaUrl } from "../shared/index.js";
import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const all = await db
    .select({
      ...getTableColumns(achievement),
      admin_name: admin.name,
    })
    .from(achievement)
    .leftJoin(admin, eq(achievement.admin_id, admin.id))
    .orderBy(desc(achievement.created_at));

  const withUrls = await Promise.all(
    all.map(async (item) => ({
      ...item,
      admin_name: item.admin_name ?? "元管理者",
      img_url: await toMediaUrl(item.img),
      movie_url: await toMediaUrl(item.movie),
      file_url: await toMediaUrl(item.file),
    })),
  );

  return c.json({ success: true, total: withUrls.length, data: withUrls }, 200);
};
