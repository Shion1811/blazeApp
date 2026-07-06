// 試合風景API（6エンドポイント）

import { Hono } from "hono";
import { createCrudRouter } from "../shared/index.js";
import { authToken } from "../db/token.js";
import { requireAdmin } from "../db/roleGuard.js";
import { getAll } from "./getAll.js";
import { getById } from "./getById.js";
import { create } from "./create.js";
import { update } from "./update.js";
import { remove } from "./delete.js";
import { updateConsent } from "./updateConsent.js";

const crudApp = createCrudRouter({
  basePath: "/api/gameImg",
  updateSubPath: ":imageId",
  getAll,
  getById,
  create,
  update,
  remove,
});

const app = new Hono();
app.route("/", crudApp);

// PATCH /api/gameImg/images/:imageId/consent — 掲載同意ステータス更新（管理者のみ）
app.patch(
  "/api/gameImg/images/:imageId/consent",
  authToken,
  requireAdmin,
  (c) => updateConsent(c),
);

export default app;
