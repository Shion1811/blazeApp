// GET /api/gameImg — 全ての試合風景を取得

import { desc, eq } from "../index.js";
import { getTableColumns } from "drizzle-orm";
import {
  db,
  game,
  admin,
  images,
  toMediaUrl,
  getRelatedMediaUrls,
} from "../shared/index.js";
import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const all = await db
    .select({
      ...getTableColumns(game),
      admin_name: admin.name,
    })
    .from(game)
    .leftJoin(admin, eq(game.admin_id, admin.id))
    .orderBy(desc(game.created_at));

  const withUrls = await Promise.all(
    all.map(async (item) => ({
      ...item,
      admin_name: item.admin_name ?? "元管理者",
      img_url: await toMediaUrl(item.img),
      images: await getRelatedMediaUrls(images, images.game_id, item.id),
    })),
  );

  return c.json({ success: true, total: withUrls.length, data: withUrls }, 200);
};
