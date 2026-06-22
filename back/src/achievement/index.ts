// 実績API（5エンドポイント）

import { createCrudRouter } from "../shared/index.js";
import { getAll } from "./getAll.js";
import { getById } from "./getById.js";
import { create } from "./create.js";
import { update } from "./update.js";
import { remove } from "./delete.js";

export default createCrudRouter({
  basePath: "/api/achievement",
  getAll,
  getById,
  create,
  update,
  remove,
});
