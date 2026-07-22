// GET /api/gameImg — 全ての試合風景を取得
// 管理者: 全画像 + consent_status を返す
// 一般: approved のみ表示（approved 画像が0件の投稿は非表示）

import { desc, eq, and } from "../index.js";
import { count, exists, getTableColumns } from "drizzle-orm";
import {
  db,
  game,
  admin,
  images,
  toMediaUrl,
  getOptionalUser,
  parsePage,
  buildPagination,
} from "../shared/index.js";
import { getVisibleGameImages } from "./visibleImages.js";
import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const { page, limit, offset } = parsePage(c);
  const user = await getOptionalUser(c);
  // memberは一般ユーザーと同じ可視性（承認済みのみ）にする。owner/adminのみ全件+ステータスを見られる
  const isAdmin = user !== null && (user.role === "owner" || user.role === "admin");

  // 一般ユーザーは approved 画像が1枚もない投稿を非表示にするため、DB側でEXISTS絞り込みする
  const visibleCondition = isAdmin
    ? undefined
    : exists(
        db
          .select({ id: images.id })
          .from(images)
          .where(and(eq(images.game_id, game.id), eq(images.consent_status, "approved"))),
      );

  const [all, totalResult] = await Promise.all([
    db
      .select({
        ...getTableColumns(game),
        admin_name: admin.name,
      })
      .from(game)
      .leftJoin(admin, eq(game.admin_id, admin.id))
      .where(visibleCondition)
      .orderBy(desc(game.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(game).where(visibleCondition),
  ]);
  const total = Number(totalResult[0]?.total ?? 0);

  // 可視性フィルタ・署名付きURLの生成はページ対象の投稿のみに対して行う
  const paged = await Promise.all(
    all.map(async (item) => {
      const imageList = await getVisibleGameImages(item.id, isAdmin);

      // 一般ユーザーのメイン画像は最初の approved 画像を使用
      const imgUrl = isAdmin ? await toMediaUrl(item.img) : (imageList[0]?.url ?? null);

      return {
        ...item,
        admin_name: item.admin_name ?? "元管理者",
        img_url: imgUrl,
        images: imageList,
      };
    }),
  );

  return c.json(
    {
      success: true,
      data: paged,
      pagination: buildPagination(page, limit, total),
    },
    200,
  );
};
