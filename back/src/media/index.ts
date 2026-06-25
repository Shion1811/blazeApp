// メディア情報API（5エンドポイント）
// ※ newsテーブルのtype='media'を使用（設計書のER図注記に基づく）
// news APIと同じロジックのため、共通のハンドラ生成関数を再利用する

import { createCrudRouter } from "../shared/index.js";
import { createNewsTypeHandlers } from "../news/handlers.js";

const { getAll, getById, create, update, remove } = createNewsTypeHandlers(
  "media",
  "メディア情報",
  "media",
);

export default createCrudRouter({
  basePath: "/api/media",
  getAll,
  getById,
  create,
  update,
  remove,
});
