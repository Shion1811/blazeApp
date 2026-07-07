// 試合風景画像を可視性に応じて取得する共通ヘルパー
// 管理者: 全画像 + consent_status を返す / 一般: approved のみ返す

import { and, eq } from "../index.js";
import { db, images, getPresignedDownloadUrl } from "../shared/index.js";

export type VisibleGameImage = {
  id: string;
  url: string;
  consent_status?: string;
};

export async function getVisibleGameImages(
  gameId: string,
  isAdmin: boolean,
): Promise<VisibleGameImage[]> {
  const records = await db
    .select()
    .from(images)
    .where(
      isAdmin
        ? eq(images.game_id, gameId)
        : and(eq(images.game_id, gameId), eq(images.consent_status, "approved")),
    );

  return Promise.all(
    records.map(async (record) => ({
      id: record.id,
      url: await getPresignedDownloadUrl(record.path),
      ...(isAdmin && { consent_status: record.consent_status }),
    })),
  );
}
