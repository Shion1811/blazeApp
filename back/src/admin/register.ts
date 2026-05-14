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
import { users } from "../db/schema.js";


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
      email: z
        .email("メールアドレス形式が正しくありません。")
        // /^[^\s]+$/の記号は空白がなく1文字以上あることの確認
        .regex(/^[^\s]+$/, "空白は使えません")
        // /^[\x20-\x7e]+$/の記号はスペースがなく漢字が含まれていないこと
        .regex(/^[\x20-\x7e]+$/, "半角英数字・記号のみ使用できます")
        // 「@」が2つ以上ないかの確認
        .refine((val) => val.split("@").length === 2, {
          message: "@は1つだけ使用してください",
        }),
      password: z
        .string()
        .min(8, "パスワードは8文字以上で入力してください。")
        // /^[^\s]+$/の記号は空白がなく1文字以上あることの確認
        .regex(/^[^\s]+$/, "空白は使えません。")
        // /^[^\u3000-\u9fff]+$/の記号はスペースがなく漢字が含まれていないこと
        .regex(/^[^\u3000-\u9fff]+$/, "全角文字は使えません。")
        .refine((val) => zxcvbn(val).score >= 3, {
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
    .from(users)
    .where(eq(users.email, email));

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
    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
    });
    // 同時アクセスされてもしっかりエラーが出る
  } catch (e: any) {
    if (e.code === "23505") {
      return c.json(
        { success: false, errors: "このメールアドレスは既に登録されています。" },
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
