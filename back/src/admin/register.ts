import {
  Hono,
  z,
  rateLimiter,
  RedisStore,
  createClient,
  zxcvbn,
} from "../index.js";

// REDISに接続
if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL が .env に設定されていません");
}
const redisNetwork = createClient({ url: process.env.REDIS_URL });
(async () => {
  await redisNetwork.connect();
})().catch((error) => {
  console.error("接続に失敗しました:", error);
});

const app = new Hono();

// 1分間に1回までの制御
const registerLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 1,
  message: "1分間に1回しか送信できません",
  // IPアドレス認識
  keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "unknown",
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisNetwork.sendCommand(args),
  }) as any,
});

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
        // /^[^\u3000-\u9fff]+$/の記号はスペースがなく漢字が含まれていないこと
        .regex(/^[^\u3000-\u9fff]+$/, "全角文字は使えません")
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

  const body = await c.req.json();
  const result = userRegisterSchema.safeParse(body);

  if (!result.success) {
    return c.json({ success: false, errors: result.error }, 400);
  }
  const { name, email } = result.data;

  return c.json(
    { success: true, message: "アカウント作成成功", data: { name, email } },
    200,
  );
});

export default app;
