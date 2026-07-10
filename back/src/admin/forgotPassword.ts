import { randomBytes, createHash } from "node:crypto";
import { isNull } from "drizzle-orm";
import {
  Hono,
  z,
  getConnInfo,
  rateLimiter,
  RedisStore,
  eq,
  and,
} from "../index.js";
import {
  db,
  admin,
  passwordResetTokens,
  emailSchema,
  redisClient,
  sendPasswordResetEmail,
} from "../shared/index.js";

const app = new Hono();

// ブルートフォース・メールアドレス列挙対策：1分間に3回まで（テスト環境ではスキップ）
const forgotPasswordLimiter =
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

// アカウントの有無に関わらず同じ文言を返す（メールアドレスの登録有無を明かさない）
const GENERIC_MESSAGE =
  "ご入力のメールアドレスが登録されている場合、パスワード再設定用のメールを送信しました。";

app.post("/api/admin/forgot-password", forgotPasswordLimiter, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, errors: "リクエストのJSON形式が不正です" },
      400,
    );
  }

  const result = z.object({ email: emailSchema }).safeParse(body);
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

  const { email } = result.data;

  // 削除済みアカウントは対象外
  const existingUsers = await db
    .select()
    .from(admin)
    .where(and(eq(admin.email, email), isNull(admin.deleted_at)));

  const user = existingUsers[0];

  // テスト環境でのみ、実メール送信を介さずトークンを検証できるようレスポンスに含める
  let debugToken: string | undefined;

  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間で失効

    // 同一ユーザーの未使用トークンは新規発行時に無効化する
    await db
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.admin_id, user.id),
          isNull(passwordResetTokens.used_at),
        ),
      );

    await db.insert(passwordResetTokens).values({
      admin_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    try {
      await sendPasswordResetEmail(user.email, rawToken);
    } catch (e) {
      // メール送信失敗時もアカウント存在は明かさず、ログのみ残す
      console.error("[forgot-password] メール送信失敗:", e);
    }

    if (process.env.NODE_ENV === "test") {
      debugToken = rawToken;
    }
  }

  return c.json(
    { success: true, message: GENERIC_MESSAGE, ...(debugToken && { token: debugToken }) },
    200,
  );
});

export default app;
