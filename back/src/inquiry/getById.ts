// GET /api/inquiry/:id — 特定の問い合わせ内容を取得（管理者のみ）

import { eq, desc } from "../index.js";
import { getTableColumns } from "drizzle-orm";
import { db, inquiry, reply, admin, toMediaUrl } from "../shared/index.js";
import type { Context } from "hono";

export const getById = async (c: Context) => {
  const id = c.req.param("id");
  if (!id) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

  const result = await db.select().from(inquiry).where(eq(inquiry.id, id));
  const item = result[0];

  if (!item) return c.json({ success: false, errors: "問い合わせが見つかりません。" }, 404);

  // 返信一覧を管理者名付きで取得
  const replies = await db
    .select({
      ...getTableColumns(reply),
      admin_name: admin.name,
    })
    .from(reply)
    .leftJoin(admin, eq(reply.admin_id, admin.id))
    .where(eq(reply.inquiry_id, id))
    .orderBy(desc(reply.created_at));

  const repliesWithUrls = await Promise.all(
    replies.map(async (r) => ({
      ...r,
      admin_name: r.admin_name ?? "元管理者",
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
