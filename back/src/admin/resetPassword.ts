import { createHash } from "node:crypto";
import { isNull } from "drizzle-orm";
import {
  Hono,
  z,
  getConnInfo,
  rateLimiter,
  RedisStore,
  zxcvbn,
  bcrypt,
  eq,
  and,
} from "../index.js";
import {
  db,
  admin,
  passwordResetTokens,
  passwordBaseSchema,
  redisClient,
} from "../shared/index.js";

const app = new Hono();

// ブルートフォース対策：1分間に5回まで（テスト環境ではスキップ）
const resetPasswordLimiter =
  process.env.NODE_ENV === "test"
    ? (_c: unknown, next: () => Promise<void>) => next()
    : rateLimiter({
        windowMs: 60 * 1000,
        limit: 5,
        message: "試行回数の上限に達しました。1分後に再試行してください。",
        keyGenerator: (c) => {
          try { return getConnInfo(c).remote.address ?? "unknown"; } catch { return "unknown"; }
        },
        store: new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        }) as any,
      });

const INVALID_TOKEN_MESSAGE =
  "無効または期限切れのトークンです。再度パスワード再設定をリクエストしてください。";

app.post("/api/admin/reset-password", resetPasswordLimiter, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, errors: "リクエストのJSON形式が不正です" },
      400,
    );
  }

  const resetSchema = z
    .object({
      token: z.string().min(1, "トークンが不正です。"),
      password: passwordBaseSchema,
      passwordConfirmation: z.string(),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
      message: "パスワードが一致しません。",
      path: ["passwordConfirmation"],
    });

  const result = resetSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      {
        success: false,
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      400,
    );
  }

  const { token, password } = result.data;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const records = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token_hash, tokenHash));

  const record = records[0];
  const isTokenValid =
    !!record && record.used_at === null && record.expires_at.getTime() > Date.now();

  if (!isTokenValid) {
    return c.json({ success: false, errors: INVALID_TOKEN_MESSAGE }, 400);
  }

  const users = await db
    .select()
    .from(admin)
    .where(and(eq(admin.id, record.admin_id), isNull(admin.deleted_at)));

  const user = users[0];
  if (!user) {
    return c.json({ success: false, errors: INVALID_TOKEN_MESSAGE }, 400);
  }

  // パスワード強度チェック（名前・メールから推測しやすいものを弾く）
  const strengthResult = zxcvbn(password, [
    user.name,
    user.email,
    user.email.split("@")[0] ?? "",
  ]);
  if (strengthResult.score < 3) {
    return c.json(
      {
        success: false,
        errors: [{ field: "password", message: "パスワードが簡単です。" }],
      },
      400,
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // パスワード更新と同時に既存セッションを無効化（再ログインを必須にする）
  await db
    .update(admin)
    .set({ password: hashedPassword, token: null })
    .where(eq(admin.id, user.id));

  // トークンを使用済みにして再利用を防ぐ
  await db
    .update(passwordResetTokens)
    .set({ used_at: new Date() })
    .where(eq(passwordResetTokens.id, record.id));

  return c.json(
    {
      success: true,
      message: "パスワードを再設定しました。新しいパスワードでログインしてください。",
    },
    200,
  );
});

export default app;
