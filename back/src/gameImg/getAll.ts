// GET /api/gameImg — 全ての試合風景を取得
// 管理者: 全画像 + consent_status を返す
// 一般: approved のみ表示（approved 画像が0件の投稿は非表示）

import { desc, eq } from "../index.js";
import { getTableColumns } from "drizzle-orm";
import { db, game, admin, toMediaUrl, getOptionalUser, parsePage, buildPagination } from "../shared/index.js";
import { getVisibleGameImages } from "./visibleImages.js";
import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const { page, limit, offset } = parsePage(c);

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

  // 可視性フィルタが必要なため、絞り込み後に件数が変わる。
  // そのためDB側でのLIMIT/OFFSETではなく、フィルタ後の配列をページ分割する。
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

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limit);

  return c.json(
    {
      success: true,
      data: paged,
      pagination: buildPagination(page, limit, total),
    },
    200,
  );
};
