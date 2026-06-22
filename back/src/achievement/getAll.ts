import { desc } from "../index.js";
import { db, achievement, getPresignedDownloadUrl } from "../shared/index.js";

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
      img_url: item.img ? await getPresignedDownloadUrl(item.img) : null,
      movie_url: item.movie ? await getPresignedDownloadUrl(item.movie) : null,
      file_url: item.file ? await getPresignedDownloadUrl(item.file) : null,
    })),
  );

  return c.json({ success: true, data: achievementsWithUrls }, 200);
};
