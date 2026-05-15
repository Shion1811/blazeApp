import {
  Hono,
  z,
  getConnInfo,
  rateLimiter,
  RedisStore,
  bcrypt,
  eq,
} from "../index.js";
import { db } from "../db/index.js";
import { admin, emailSchema, passwordBaseSchema } from "../db/schema.js";
import { redisClient } from "../db/redis.js";

const app = new Hono();

// 1分間に5回までの制御
const loginLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  message: "ログイン試行回数の上限に達しました。1分後に再試行してください。",
  // IPアドレス認識
  keyGenerator: (c) => getConnInfo(c).remote.address ?? "unknown",
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }) as any,
});

app.post("/api/admin/login", loginLimiter, async (c) => {
  // ログイン用スキーマ（名前・パスワード確認は不要）
  const loginSchema = z.object({
    email: emailSchema,
    password: passwordBaseSchema,
  });

  // JSONパースを安全に行う
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, errors: "リクエストのJSON形式が不正です" },
      400,
    );
  }

  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return c.json({ success: false, errors: result.error }, 400);
  }
  const { email, password } = result.data;

  // メールアドレスでユーザーを検索
  const existingUsers = await db
    .select()
    .from(admin)
    .where(eq(admin.email, email));

  const user = existingUsers[0];
  if (!user) {
    // ユーザー不一致エラー
    return c.json(
      {
        success: false,
        errors: "メールアドレスまたはパスワードが正しくありません。",
      },
      401,
    );
  }

  // パスワードの照合
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // パスワード不一致エラー
    return c.json(
      {
        success: false,
        errors: "メールアドレスまたはパスワードが正しくありません。",
      },
      401,
    );
  }
  // トークンを生成してDBに保存
  const { randomBytes } = await import("node:crypto");
  const token = randomBytes(32).toString("hex");

  await db
    .update(admin)
    .set({ token })
    .where(eq(admin.id, user.id));

  // 成功
  return c.json(
    {
      success: true,
      message: "ログイン成功",
      data: { name: user.name, email: user.email, token },
    },
    200,
  );
});

export default app;
