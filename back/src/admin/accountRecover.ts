import { randomBytes } from "node:crypto";
import { hashToken } from "../db/token.js";
import {
  Hono,
  z,
  getConnInfo,
  rateLimiter,
  RedisStore,
  bcrypt,
  eq,
} from "../index.js";
import {
  db,
  admin,
  emailSchema,
  passwordBaseSchema,
  redisClient,
} from "../shared/index.js";

const app = new Hono();

// ブルートフォース対策：1分間に3回まで（テスト環境ではスキップ）
const recoverLimiter =
  process.env.NODE_ENV === "test"
    ? (_c: unknown, next: () => Promise<void>) => next()
    : rateLimiter({
        windowMs: 60 * 1000,
        limit: 3,
        message: "試行回数の上限に達しました。1分後に再試行してください。",
        keyGenerator: (c) => {
          try { return getConnInfo(c).remote.address ?? "unknown"; } catch { return "unknown"; }
        },
        store: new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        }) as any,
      });

// タイミング攻撃対策用ダミーハッシュ
const DUMMY_HASH =
  "$2b$10$ucIQ1FyfVwNqFMLtewRsn.NQtZluHjjNAb7sgNh/W0SOTf1lOVWnC";

app.post("/api/admin/account-recover", recoverLimiter, async (c) => {
  const recoverSchema = z.object({
    email: emailSchema,
    password: passwordBaseSchema,
  });

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, errors: "リクエストのJSON形式が不正です" },
      400,
    );
  }

  const result = recoverSchema.safeParse(body);
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

  const { email, password } = result.data;

  // 削除済みを含む全ユーザーを検索
  const existingUsers = await db
    .select()
    .from(admin)
    .where(eq(admin.email, email));

  const user = existingUsers[0];

  // タイミング攻撃対策：常にbcrypt.compareを実行
  const isPasswordValid = await bcrypt.compare(
    password,
    user?.password ?? DUMMY_HASH,
  );

  if (!user || !isPasswordValid) {
    return c.json(
      {
        success: false,
        errors: "メールアドレスまたはパスワードが正しくありません。",
      },
      401,
    );
  }

  // 削除されていないアカウントは復活不要
  if (!user.deleted_at) {
    return c.json(
      { success: false, errors: "このアカウントは削除されていません。" },
      400,
    );
  }

  // 30日超過チェック
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (user.deleted_at < thirtyDaysAgo) {
    return c.json(
      {
        success: false,
        errors:
          "削除から30日が経過しているため、アカウントを復活できません。",
      },
      403,
    );
  }

  // 復活：deleted_at をクリアして新しいトークンを発行
  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawToken);
  const tokenIssuedAt = new Date();

  await db
    .update(admin)
    .set({ deleted_at: null, token: hashedToken, token_issued_at: tokenIssuedAt })
    .where(eq(admin.id, user.id));

  c.header(
    "Set-Cookie",
    `token=${rawToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`,
  );

  return c.json(
    {
      success: true,
      message: "アカウントを復活しました。",
      data: { name: user.name, email: user.email },
    },
    200,
  );
});

export default app;
