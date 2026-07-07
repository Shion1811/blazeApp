// GET /api/gameImg — 全ての試合風景を取得
// 管理者: 全画像 + consent_status を返す
// 一般: approved のみ表示（approved 画像が0件の投稿は非表示）

import { desc, eq } from "../index.js";
import { getTableColumns } from "drizzle-orm";
import { db, game, admin, toMediaUrl, getOptionalUser } from "../shared/index.js";
import { getVisibleGameImages } from "./visibleImages.js";
import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const [user, all] = await Promise.all([
    getOptionalUser(c),
    db
      .select({
        ...getTableColumns(game),
        admin_name: admin.name,
      })
      .from(game)
      .leftJoin(admin, eq(game.admin_id, admin.id))
      .orderBy(desc(game.created_at)),
  ]);
  const isAdmin = user !== null;

  const filtered = (
    await Promise.all(
      all.map(async (item) => {
        const imageList = await getVisibleGameImages(item.id, isAdmin);

        // 一般ユーザーは approved 画像が1枚もない投稿を非表示にする
        if (!isAdmin && imageList.length === 0) return null;

        // 一般ユーザーのメイン画像は最初の approved 画像を使用
        const imgUrl = isAdmin ? await toMediaUrl(item.img) : (imageList[0]?.url ?? null);

        return {
          ...item,
          admin_name: item.admin_name ?? "元管理者",
          img_url: imgUrl,
          images: imageList,
        };
      }),
    )
  ).filter((item) => item !== null);

  return c.json({ success: true, total: filtered.length, data: filtered }, 200);
};
