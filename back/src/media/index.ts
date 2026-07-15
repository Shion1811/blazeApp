// メディア情報API（6エンドポイント）
// ※ newsテーブルのtype='media'を使用（設計書のER図注記に基づく）
// news APIと同じロジックのため、共通のハンドラ生成関数を再利用する

import { Hono } from "hono";
import { createCrudRouter } from "../shared/index.js";
import { createNewsTypeHandlers } from "../news/handlers.js";

const { getAll, getById, create, update, remove, getCategories } =
  createNewsTypeHandlers("media", "メディア情報", "media");

const crudApp = createCrudRouter({
  basePath: "/api/media",
  getAll,
  getById,
  create,
  update,
  remove,
});

const app = new Hono();
// :id との衝突を避けるため先に登録
app.get("/api/media/categories", (c) => getCategories(c));
app.route("/", crudApp);

export default app;
