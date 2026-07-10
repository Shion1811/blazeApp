// パスワード再設定フロー統合テスト
import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import { cleanDb } from "./setup.js";
import { extractCookie } from "./testHelpers.js";

const D = "@reset.test";
const NEW_PASSWORD = "NewTest@Password2!";

beforeEach(async () => {
  await cleanDb();
});

async function register(name: string, email: string, password: string) {
  return app.request("/api/admin/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, passwordConfirmation: password }),
  });
}

async function login(email: string, password: string) {
  return app.request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

async function forgotPassword(email: string) {
  return app.request("/api/admin/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

async function resetPassword(
  token: string,
  password: string,
  passwordConfirmation?: string,
) {
  return app.request("/api/admin/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      password,
      passwordConfirmation: passwordConfirmation ?? password,
    }),
  });
}

/** テスト環境限定でforgot-passwordのレスポンスに含まれる生トークンを取り出す */
async function requestResetToken(email: string): Promise<string> {
  const res = await forgotPassword(email);
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("テスト環境でtokenが返されていません");
  return body.token;
}

// --- forgot-password ---

describe("POST /api/admin/forgot-password", () => {
  it("登録済みメールなら再設定用トークンを発行する", async () => {
    const email = `reset1${D}`;
    await register("Reset User", email, "Test@Password1!");

    const res = await forgotPassword(email);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; token?: string };
    expect(body.success).toBe(true);
    expect(body.token).toEqual(expect.any(String));
  });

  it("未登録メールでも同じ成功レスポンスを返す（列挙対策）", async () => {
    const res = await forgotPassword(`nobody${D}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; token?: string };
    expect(body.success).toBe(true);
    expect(body.token).toBeUndefined();
  });
});

// --- reset-password ---

describe("POST /api/admin/reset-password", () => {
  it("有効なトークンで新しいパスワードに変更できる", async () => {
    const email = `reset2${D}`;
    await register("Reset User2", email, "Test@Password1!");
    const token = await requestResetToken(email);

    const res = await resetPassword(token, NEW_PASSWORD);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const newLogin = await login(email, NEW_PASSWORD);
    expect(newLogin.status).toBe(200);

    const oldLogin = await login(email, "Test@Password1!");
    expect(oldLogin.status).toBe(401);
  });

  it("同じトークンは2回使えない", async () => {
    const email = `reset3${D}`;
    await register("Reset User3", email, "Test@Password1!");
    const token = await requestResetToken(email);

    const first = await resetPassword(token, NEW_PASSWORD);
    expect(first.status).toBe(200);

    const second = await resetPassword(token, "AnotherTest@Password3!");
    expect(second.status).toBe(400);
  });

  it("無効なトークンは400", async () => {
    const res = await resetPassword("this-token-does-not-exist", NEW_PASSWORD);
    expect(res.status).toBe(400);
  });

  it("パスワード確認が一致しない場合は400", async () => {
    const email = `reset4${D}`;
    await register("Reset User4", email, "Test@Password1!");
    const token = await requestResetToken(email);

    const res = await resetPassword(token, NEW_PASSWORD, "Mismatch@Password9!");
    expect(res.status).toBe(400);
  });

  it("再設定後は既存セッションが無効化される", async () => {
    const email = `reset5${D}`;
    const regRes = await register("Reset User5", email, "Test@Password1!");
    const cookie = extractCookie(regRes.headers.get("set-cookie") ?? "");

    const token = await requestResetToken(email);
    await resetPassword(token, NEW_PASSWORD);

    const usersRes = await app.request("/api/admin/users", { headers: { Cookie: cookie } });
    expect(usersRes.status).toBe(401);
  });
});
