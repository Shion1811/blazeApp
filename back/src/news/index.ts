// ニュースAPI（5エンドポイント）

import { createCrudRouter } from "../shared/index.js";
import { createNewsTypeHandlers } from "./handlers.js";

const { getAll, getById, create, update, remove } = createNewsTypeHandlers(
  "news",
  "ニュース",
  "news",
);

export default createCrudRouter({
  basePath: "/api/news-post",
  getAll,
  getById,
  create,
  update,
  remove,
});
