// GET /api/gameImg/:id — 特定の試合風景を取得

import { eq } from "../index.js";
import {
  db,
  game,
  images,
  toMediaUrl,
  getRelatedMediaUrls,
} from "../shared/index.js";
import type { Context } from "hono";

export const getById = async (c: Context) => {
  const id = c.req.param("id");
  if (!id) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

  const result = await db.select().from(game).where(eq(game.id, id));
  const item = result[0];

  if (!item) return c.json({ success: false, errors: "試合風景が見つかりません。" }, 404);

  return c.json(
    {
      success: true,
      data: {
        ...item,
        img_url: await toMediaUrl(item.img),
        images: await getRelatedMediaUrls(images, images.game_id, id),
      },
    },
    200,
  );
};
