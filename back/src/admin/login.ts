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

// タイミング攻撃対策用のダミーハッシュ（ユーザーが存在しない場合に使用）
// bcrypt.compareが必ず失敗する正規の60文字ハッシュ。形式が不正だとエラーになるため実在するハッシュを使用
const DUMMY_HASH =
  "$2b$10$ucIQ1FyfVwNqFMLtewRsn.NQtZluHjjNAb7sgNh/W0SOTf1lOVWnC";

const app = new Hono();

// 1分間に5回までの制御（テスト環境ではスキップ）
const loginLimiter =
  process.env.NODE_ENV === "test"
    ? (_c: unknown, next: () => Promise<void>) => next()
    : rateLimiter({
        windowMs: 60 * 1000,
        limit: 5,
        message: "ログイン試行回数の上限に達しました、1分後に再試行してください。",
        keyGenerator: (c) => {
          try { return getConnInfo(c).remote.address ?? "unknown"; } catch { return "unknown"; }
        },
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
    // ZodErrorを整形して返す（生のエラーオブジェクトをそのまま返さない）
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

  // メールアドレスでユーザーを検索
  const existingUsers = await db
    .select()
    .from(admin)
    .where(eq(admin.email, email));

  const user = existingUsers[0];

  // タイミング攻撃対策：ユーザーが存在しない場合もダミーハッシュでbcrypt.compareを実行し応答時間を均一化
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

  // 削除済みアカウントの確認（パスワード一致後のみ案内してアカウント存在を明かさない）
  if (user.deleted_at) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (user.deleted_at > thirtyDaysAgo) {
      return c.json(
        {
          success: false,
          errors:
            "このアカウントは削除済みです。30日以内であれば /api/admin/account-recover から復活できます。",
        },
        403,
      );
    }
    // 30日超過→存在しないとして扱う
    return c.json(
      {
        success: false,
        errors: "メールアドレスまたはパスワードが正しくありません。",
      },
      401,
    );
  }

  // トークンを生成してDBに保存
  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawToken);
  const tokenIssuedAt = new Date();

  await db
    .update(admin)
    .set({ token: hashedToken, token_issued_at: tokenIssuedAt })
    .where(eq(admin.id, user.id));

  c.header(
    "Set-Cookie",
    // token=${rawToken}はCookieの名前と値
    //  HttpOnlyはXSS攻撃対策
    //  Secureはhttpsのみ送信可能httpは不可
    // SameSite=StrictはCSRF攻撃対策
    // Path=/はサイト全体でCookieの使用が可能
    // Max-Age=2592000は1ヶ月
    `token=${rawToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`);
  // 成功（tokenはHttpOnly Cookieで送信済み。レスポンスボディには含めない）
  return c.json(
    {
      success: true,
      message: "ログイン成功",
      data: {
        name: user.name,
        email: user.email,
      },
    },
    200,
  );
});

export default app;
