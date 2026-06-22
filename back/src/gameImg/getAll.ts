// GET /api/gameImg — 全ての試合風景を取得

import { desc } from "../index.js";
import {
  db,
  game,
  images,
  toMediaUrl,
  getRelatedMediaUrls,
} from "../shared/index.js";
import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const allGames = await db.select().from(game).orderBy(desc(game.created_at));

  // 各試合風景にメイン画像URL・関連画像URLを付与
  const gamesWithUrls = await Promise.all(
    allGames.map(async (item) => ({
      ...item,
      img_url: await toMediaUrl(item.img),
      images: await getRelatedMediaUrls(images, images.game_id, item.id),
    })),
  );

  return c.json({ success: true, data: gamesWithUrls }, 200);
};
