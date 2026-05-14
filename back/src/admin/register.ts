import {
  Hono,
  z,
  getConnInfo,
  rateLimiter,
  RedisStore,
  createClient,
  zxcvbn,
  bcrypt,
  eq,
} from "../index.js";
import { db } from "../db/index.js";
import { admin, emailSchema, passwordBaseSchema } from "../db/schema.js";

// REDISに接続
if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL が .env に設定されていません");
}
const redisNetwork = createClient({ url: process.env.REDIS_URL });
await redisNetwork.connect();

const app = new Hono();

// 1分間に1回までの制御
const registerLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 1,
  message: "1分間に1回しか送信できません",
  // IPアドレス認識
  keyGenerator: (c) => getConnInfo(c).remote.address ?? "unknown",
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisNetwork.sendCommand(args),
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

app.get("/api", (c) => c.json({ status: "ok" }));

app.post("/api/admin/register", registerLimiter, async (c) => {
  const userRegisterSchema = z
    .object({
      name: z
        .string()
        .min(1, "名前を入力してください。")
        .max(20, "20文字以内で入力してください。"),
      email: emailSchema,
      password: passwordBaseSchema.refine((val) => zxcvbn(val).score >= 3, {
        message: "パスワードが簡単です。",
      }),
      passwordConfirmation: z.string(),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
      message: "パスワードが一致しません。",
      path: ["passwordConfirmation"], // エラーをpasswordConfirmationフィールドに表示させる
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
    return c.json({ success: false, errors: result.error }, 400);
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

  try {
    // DBにユーザーデータを保存
    await db.insert(admin).values({
      name,
      email,
      password: hashedPassword,
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

  // 成功
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
