// GET /api/inquiry/:id — 特定の問い合わせ内容を取得（管理者のみ）

import { eq, desc } from "../index.js";
import { db, inquiry, reply, toMediaUrl } from "../shared/index.js";
import type { Context } from "hono";

export const getById = async (c: Context) => {
  const id = c.req.param("id");
  if (!id) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

  const result = await db.select().from(inquiry).where(eq(inquiry.id, id));
  const item = result[0];

  if (!item) return c.json({ success: false, errors: "問い合わせが見つかりません。" }, 404);

  // この問い合わせへの返信を取得
  const replies = await db
    .select()
    .from(reply)
    .where(eq(reply.inquiry_id, id))
    .orderBy(desc(reply.created_at));

  // 返信の画像・ファイルにも署名付きURLを付与
  const repliesWithUrls = await Promise.all(
    replies.map(async (r) => ({
      ...r,
      img_url: await toMediaUrl(r.img),
      file_url: await toMediaUrl(r.file),
    })),
  );

  return c.json(
    {
      success: true,
      data: {
        ...item,
        img_url: await toMediaUrl(item.img),
        replies: repliesWithUrls,
      },
    },
    200,
  );
};
