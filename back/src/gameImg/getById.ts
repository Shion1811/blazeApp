// GET /api/gameImg/:id — 特定の試合風景を取得
// 管理者: 全画像 + consent_status を返す
// 一般: approved のみ表示

import { eq, and } from "../index.js";
import { getTableColumns } from "drizzle-orm";
import {
  db,
  game,
  admin,
  images,
  toMediaUrl,
  getPresignedDownloadUrl,
  getOptionalUser,
} from "../shared/index.js";
import type { Context } from "hono";

export const getById = async (c: Context) => {
  const id = c.req.param("id");
  if (!id) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

  const user = await getOptionalUser(c);
  const isAdmin = user !== null;

  const result = await db
    .select({
      ...getTableColumns(game),
      admin_name: admin.name,
    })
    .from(game)
    .leftJoin(admin, eq(game.admin_id, admin.id))
    .where(eq(game.id, id));

  const item = result[0];
  if (!item) return c.json({ success: false, errors: "試合風景が見つかりません。" }, 404);

  const imageRecords = await db
    .select()
    .from(images)
    .where(
      isAdmin
        ? eq(images.game_id, id)
        : and(eq(images.game_id, id), eq(images.consent_status, "approved")),
    );

  // 一般ユーザーは approved 画像が1枚もない投稿を非表示にする
  if (!isAdmin && imageRecords.length === 0) {
    return c.json({ success: false, errors: "試合風景が見つかりません。" }, 404);
  }

  const imageList = await Promise.all(
    imageRecords.map(async (img) => ({
      id: img.id,
      url: await getPresignedDownloadUrl(img.path),
      ...(isAdmin && { consent_status: img.consent_status }),
    })),
  );

  const imgUrl = isAdmin
    ? await toMediaUrl(item.img)
    : (imageList[0]?.url ?? null);

  return c.json(
    {
      success: true,
      data: {
        ...item,
        admin_name: item.admin_name ?? "元管理者",
        img_url: imgUrl,
        images: imageList,
      },
    },
    200,
  );
};
