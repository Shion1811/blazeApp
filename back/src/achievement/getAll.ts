import { desc } from "../index.js";
import { db, achievement, toMediaUrl } from "../shared/index.js";

import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const allAchievements = await db
    // achievementテーブル全ての情報を取得
    .select()
    .from(achievement)
    // descで新しい順に表示
    // descを外すと古い順になる
    .orderBy(desc(achievement.created_at));

  // img, movie, fileの著名付きURLを生成しなければnull
  const achievementsWithUrls = await Promise.all(
    allAchievements.map(async (item) => ({
      ...item,
      img_url: await toMediaUrl(item.img),
      movie_url: await toMediaUrl(item.movie),
      file_url: await toMediaUrl(item.file),
    })),
  );

  return c.json({ success: true, total: achievementsWithUrls.length, data: achievementsWithUrls }, 200);
};
