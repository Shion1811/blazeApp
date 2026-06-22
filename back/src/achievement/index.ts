// 実績API（5エンドポイント）

import { Hono } from "../index.js";
import { admin, authToken } from "../shared/index.js";
import { getAll } from "./getAll.js";
import { getById } from "./getById.js";
import { create } from "./create.js";
import { update } from "./update.js";
import { remove } from "./delete.js";

// adminテーブルの結果を返す
type Variables = {
  user: typeof admin.$inferSelect;
};

const app = new Hono<{ Variables: Variables }>();

// GET /api/achievement — 全ての実績を取得
app.get("/api/achievement", (c) => getAll(c));

// GET /api/achievement/:id — 特定の実績を取得
app.get("/api/achievement/:id", (c) => getById(c));

// POST /api/achievement — 実績を投稿（管理者のみ）
app.post("/api/achievement", authToken, (c) => create(c));

// PATCH /api/achievement/:id — 実績の投稿を編集（管理者のみ）
app.patch("/api/achievement/:id", authToken, (c) => update(c));

// DELETE /api/achievement/:id — 実績の投稿を削除（管理者のみ）
app.delete("/api/achievement/:id", authToken, (c) => remove(c));

export default app;

