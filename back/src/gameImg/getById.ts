// GET /api/gameImg/:id — 特定の試合風景を取得
// 管理者: 全画像 + consent_status を返す
// 一般: approved のみ表示

import { eq } from "../index.js";
import { getTableColumns } from "drizzle-orm";
import { db, game, admin, toMediaUrl, getOptionalUser } from "../shared/index.js";
import { getVisibleGameImages } from "./visibleImages.js";
import type { Context } from "hono";

export const getById = async (c: Context) => {
  const id = c.req.param("id");
  if (!id) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

  const [user, result] = await Promise.all([
    getOptionalUser(c),
    db
      .select({
        ...getTableColumns(game),
        admin_name: admin.name,
      })
      .from(game)
      .leftJoin(admin, eq(game.admin_id, admin.id))
      .where(eq(game.id, id)),
  ]);
  const isAdmin = user !== null;

  const item = result[0];
  if (!item) return c.json({ success: false, errors: "試合風景が見つかりません。" }, 404);

  const imageList = await getVisibleGameImages(id, isAdmin);

  // 一般ユーザーは approved 画像が1枚もない投稿を非表示にする
  if (!isAdmin && imageList.length === 0) {
    return c.json({ success: false, errors: "試合風景が見つかりません。" }, 404);
  }

  const imgUrl = isAdmin ? await toMediaUrl(item.img) : (imageList[0]?.url ?? null);

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
