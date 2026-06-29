import { randomBytes } from "node:crypto";
import {
  Hono,
  z,
  getConnInfo,
  rateLimiter,
  RedisStore,
  zxcvbn,
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

// 1分間に1回までの制御
const registerLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 1,
  message: "1分間に1回しか送信できません",
  keyGenerator: (c) => getConnInfo(c).remote.address ?? "unknown",
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }) as any,
});

// パスワードのハッシュ化
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};
// パスワードの検証
export const comparePassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

app.post("/api/admin/register", registerLimiter, async (c) => {
  const userRegisterSchema = z
    .object({
      name: z
        .string()
        .min(1, "名前を入力してください。")
        .max(20, "20文字以内で入力してください。"),
      email: emailSchema,
      password: passwordBaseSchema,
      passwordConfirmation: z.string(),
    })
    .superRefine((data, ctx) => {
      // パスワードの強度チェック（name / email / emailのユーザー名部分も考慮）
      const strengthResult = zxcvbn(data.password, [
        data.name,
        data.email,
        data.email.split("@")[0] ?? "",
      ]);
      if (strengthResult.score < 3) {
        ctx.addIssue({
          code: "custom",
          message: "パスワードが簡単です。",
          path: ["password"],
        });
      }

      // パスワード確認チェック
      if (data.password !== data.passwordConfirmation) {
        ctx.addIssue({
          code: "custom",
          path: ["passwordConfirmation"],
          message: "パスワードが一致しません。",
        });
      }
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

  const result = userRegisterSchema.safeParse(body);
  // DB接続検証
  if (!result.success) {
    // 失敗
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
  const { name, email, password } = result.data;

  // メールアドレスの重複チェック
  const existingUser = await db
    .select()
    .from(admin)
    .where(eq(admin.email, email));

  if (existingUser.length > 0) {
    return c.json(
      { success: false, errors: "このメールアドレスは既に登録されています。" },
      409,
    );
  }

  // パスワードのハッシュ化
  const hashedPassword = await hashPassword(password);

  // トークンを生成
  const token = randomBytes(32).toString("hex");
  const token_issued_at = new Date();

  try {
    // DBにユーザーデータを保存
    await db.insert(admin).values({
      name,
      email,
      password: hashedPassword,
      token,
      token_issued_at,
    });
    // 同時アクセスされてもしっかりエラーが出る
  } catch (e: any) {
    if (e.code === "23505") {
      return c.json(
        {
          success: false,
          errors: "このメールアドレスは既に登録されています。",
        },
        409,
      );
    }
    throw e;
  }

  c.header(
    "Set-Cookie",
    `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`,
  );
  // 成功（tokenはHttpOnly Cookieで送信済み。レスポンスボディには含めない）
  return c.json(
    {
      success: true,
      message: "アカウント作成成功",
      data: { name, email },
    },
    200,
  );
});

export default app;
