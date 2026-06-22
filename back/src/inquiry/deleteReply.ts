// DELETE /api/inquiry/:id/reply/:reply_id — 返信を削除（管理者のみ）

import { eq } from "../index.js";
import { db, reply, deleteFromS3 } from "../shared/index.js";
import type { Context } from "hono";

export const deleteReply = async (c: Context) => {
  const replyId = c.req.param("reply_id");
  if (!replyId) return c.json({ success: false, errors: "返信IDが指定されていません。" }, 400);

  const existing = await db.select().from(reply).where(eq(reply.id, replyId));
  if (existing.length === 0) {
    return c.json({ success: false, errors: "返信が見つかりません。" }, 404);
  }

  const replyData = existing[0]!;

  // S3から画像・ファイルを削除
  if (replyData.img) await deleteFromS3(replyData.img);
  if (replyData.file) await deleteFromS3(replyData.file);

  // DBから削除
  await db.delete(reply).where(eq(reply.id, replyId));

  return c.json({ success: true, message: "返信を削除しました。" }, 200);
};
