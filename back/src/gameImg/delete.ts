// DELETE /api/gameImg/:id — 試合風景の投稿を削除（管理者のみ）

import { eq } from "../index.js";
import { db, game, images, deleteFromS3, deleteMediaFromS3 } from "../shared/index.js";
import type { Context } from "hono";

export const remove = async (c: Context) => {
  const id = c.req.param("id");
  if (!id) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

  const existing = await db.select().from(game).where(eq(game.id, id));
  if (existing.length === 0) {
    return c.json({ success: false, errors: "試合風景が見つかりません。" }, 404);
  }

  // メイン画像をS3から削除
  if (existing[0]!.img) await deleteFromS3(existing[0]!.img);

  // 関連画像をS3から全件削除
  const relatedImages = await db.select().from(images).where(eq(images.game_id, id));
  await deleteMediaFromS3(relatedImages);

  // DBから削除（CASCADE設定でimagesも自動削除）
  await db.delete(game).where(eq(game.id, id));

  return c.json({ success: true, message: "試合風景を削除しました。" }, 200);
};
