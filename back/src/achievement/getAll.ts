import { desc, eq } from "../index.js";
import { count, getTableColumns } from "drizzle-orm";
import {
  db,
  achievement,
  admin,
  toMediaUrl,
  parsePage,
  buildPagination,
} from "../shared/index.js";
import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const { page, limit, offset } = parsePage(c);

  const [all, totalResult] = await Promise.all([
    db
      .select({
        ...getTableColumns(achievement),
        admin_name: admin.name,
      })
      .from(achievement)
      .leftJoin(admin, eq(achievement.admin_id, admin.id))
      .orderBy(desc(achievement.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(achievement),
  ]);
  const total = totalResult[0]?.total ?? 0;

  const withUrls = await Promise.all(
    all.map(async (item) => ({
      ...item,
      admin_name: item.admin_name ?? "元管理者",
      img_url: await toMediaUrl(item.img),
      movie_url: await toMediaUrl(item.movie),
      file_url: await toMediaUrl(item.file),
    })),
  );

  return c.json(
    {
      success: true,
      data: withUrls,
      pagination: buildPagination(page, limit, total),
    },
    200,
  );
};
