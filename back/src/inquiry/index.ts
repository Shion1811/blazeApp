// 問い合わせAPI（5エンドポイント）

import {
  Hono,
  getConnInfo,
  rateLimiter,
  RedisStore,
} from "../index.js";
import { admin, authToken, redisClient } from "../shared/index.js";
import { getAll } from "./getAll.js";
import { getById } from "./getById.js";
import { create } from "./create.js";
import { createReply } from "./reply.js";
import { deleteReply } from "./deleteReply.js";

type Variables = {
  user: typeof admin.$inferSelect;
};

const app = new Hono<{ Variables: Variables }>();

// 問い合わせ送信のレートリミット（1分に1回まで）
const inquiryLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 1,
  message: "1分間に1回しか送信できません。",
  keyGenerator: (c) => getConnInfo(c).remote.address ?? "unknown",
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }) as any,
});

// GET /api/inquiry — 全ての問い合わせを取得（管理者のみ）
app.get("/api/inquiry", authToken, (c) => getAll(c));

// GET /api/inquiry/:id — 特定の問い合わせ内容を取得（管理者のみ）
app.get("/api/inquiry/:id", authToken, (c) => getById(c));

// POST /api/inquiry — お客様からの問い合わせ（認証不要）
app.post("/api/inquiry", inquiryLimiter, (c) => create(c));

// POST /api/inquiry/:id/reply — 問い合わせへの返信（管理者のみ）
app.post("/api/inquiry/:id/reply", authToken, (c) => createReply(c));

// DELETE /api/inquiry/:id/reply/:reply_id — 返信を削除（管理者のみ）
app.delete("/api/inquiry/:id/reply/:reply_id", authToken, (c) => deleteReply(c));

export default app;
