// ニュースAPI（6エンドポイント）

import { Hono } from "hono";
import { createCrudRouter } from "../shared/index.js";
import { createNewsTypeHandlers } from "./handlers.js";

const { getAll, getById, create, update, remove, getCategories } =
  createNewsTypeHandlers("news", "ニュース", "news");

const crudApp = createCrudRouter({
  basePath: "/api/news-post",
  getAll,
  getById,
  create,
  update,
  remove,
});

const app = new Hono();
// :id との衝突を避けるため先に登録
app.get("/api/news-post/categories", (c) => getCategories(c));
app.route("/", crudApp);

export default app;
