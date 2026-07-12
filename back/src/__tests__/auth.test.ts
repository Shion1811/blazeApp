// 認証フロー統合テスト
import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import { cleanDb } from "./setup.js";
import { extractCookie, registerAndLogin, getUsers } from "./testHelpers.js";

const D = "@auth.test";

beforeEach(async () => {
  await cleanDb();
});

async function register(name: string, email: string, password: string, passwordConfirmation?: string) {
  return app.request("/api/admin/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, passwordConfirmation: passwordConfirmation ?? password }),
  });
}

async function login(email: string, password: string) {
  return app.request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

/** owner を2人登録し、1人目のCookieを返す（自己削除には他ownerが必要なため） */
async function registerTwoOwners(email1: string, email2: string): Promise<string> {
  const cookie1 = await registerAndLogin("Owner1", email1);
  await registerAndLogin("Owner2", email2);

  const users = await getUsers(cookie1);
  const secondId = users.find((u) => u.email === email2)?.id;
  if (!secondId) throw new Error("2人目のユーザーが見つかりません");

  const roleRes = await app.request(`/api/admin/users/${secondId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie1 },
    body: JSON.stringify({ role: "owner" }),
  });
  if (roleRes.status !== 200) {
    const body = await roleRes.text();
    throw new Error(`role update failed: ${roleRes.status} ${body}`);
  }

  return cookie1;
}

// --- Register ---

describe("POST /api/admin/register", () => {
  it("初回登録者は owner になる", async () => {
    const res = await register("Test Owner", `owner${D}`, "Test@Password1!");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { name: string } };
    expect(body.success).toBe(true);

    const cookie = extractCookie(res.headers.get("set-cookie") ?? "");
    const usersRes = await app.request("/api/admin/users", { headers: { Cookie: cookie } });
    expect(usersRes.status).toBe(200);
    const usersBody = await usersRes.json() as { data: Array<{ email: string; role: string }> };
    expect(usersBody.data.find((u) => u.email === `owner${D}`)?.role).toBe("owner");
  });

  it("2人目以降は member になる", async () => {
    await register("Owner", `owner${D}`, "Test@Password1!");
    const res2 = await register("Member", `member${D}`, "Test@Password1!");
    expect(res2.status).toBe(200);

    const cookie = await registerAndLogin("_owner", `owner2${D}`);
    void cookie; // owner登録済みなので新loginで確認

    const loginRes = await login(`owner${D}`, "Test@Password1!");
    const ownerCookie = extractCookie(loginRes.headers.get("set-cookie") ?? "");
    const usersRes = await app.request("/api/admin/users", { headers: { Cookie: ownerCookie } });
    expect(usersRes.status).toBe(200);
    const usersBody = await usersRes.json() as { data: Array<{ email: string; role: string }> };
    expect(usersBody.data.find((u) => u.email === `member${D}`)?.role).toBe("member");
  });

  it("パスワード不一致は 400", async () => {
    const res = await register("Test", `pw${D}`, "Test@Password1!", "WrongPass!");
    expect(res.status).toBe(400);
    expect((await res.json() as { success: boolean }).success).toBe(false);
  });

  it("重複メールは 409", async () => {
    await register("Test", `dup${D}`, "Test@Password1!");
    expect((await register("Test2", `dup${D}`, "Test@Password1!")).status).toBe(409);
  });

  it("HttpOnly Cookie が発行される", async () => {
    const res = await register("Test", `cookie${D}`, "Test@Password1!");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
  });
});

// --- Login ---

describe("POST /api/admin/login", () => {
  it("正しい認証情報でログイン成功", async () => {
    await register("User", `login${D}`, "Test@Password1!");
    const res = await login(`login${D}`, "Test@Password1!");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(body.data).not.toHaveProperty("token");
  });

  it("パスワード誤りは 401", async () => {
    await register("User", `wrong${D}`, "Test@Password1!");
    expect((await login(`wrong${D}`, "WrongPass@1!")).status).toBe(401);
  });

  it("存在しないメールは 401", async () => {
    expect((await login(`nobody${D}`, "Test@Password1!")).status).toBe(401);
  });

  it("HttpOnly Cookie が発行される", async () => {
    await register("User", `cookielogin${D}`, "Test@Password1!");
    const res = await login(`cookielogin${D}`, "Test@Password1!");
    expect(res.headers.get("set-cookie") ?? "").toContain("HttpOnly");
  });
});

// --- authToken ---

describe("authToken ミドルウェア", () => {
  it("Cookie なしは 401", async () => {
    expect((await app.request("/api/admin/users")).status).toBe(401);
  });

  it("無効な Cookie は 401", async () => {
    const res = await app.request("/api/admin/users", {
      headers: { Cookie: "token=invalidtoken123" },
    });
    expect(res.status).toBe(401);
  });
});

// --- Account Delete ---

describe("DELETE /api/admin/account-delete", () => {
  it("パスワード確認でソフトデリート・Cookie 削除", async () => {
    const cookie = await registerTwoOwners(`del${D}`, `del-co${D}`);
    const res = await app.request("/api/admin/account-delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ password: "Test@Password1!" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toContain("Max-Age=0");
  });

  it("パスワード誤りは 401", async () => {
    const cookie = await registerAndLogin("DelUser2", `del2${D}`);
    const res = await app.request("/api/admin/account-delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ password: "WrongPass@1!" }),
    });
    expect(res.status).toBe(401);
  });

  it("削除後は Cookie でアクセス不可（401）", async () => {
    const cookie = await registerTwoOwners(`del3${D}`, `del3-co${D}`);
    await app.request("/api/admin/account-delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ password: "Test@Password1!" }),
    });
    expect((await app.request("/api/admin/users", { headers: { Cookie: cookie } })).status).toBe(401);
  });
});

// --- 削除済みアカウントのログイン ---

describe("削除済みアカウントのログイン", () => {
  it("削除から30日以内は 403（復活案内）", async () => {
    const cookie = await registerTwoOwners(`deleted${D}`, `deleted-co${D}`);
    await app.request("/api/admin/account-delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ password: "Test@Password1!" }),
    });
    const reloginRes = await login(`deleted${D}`, "Test@Password1!");
    expect(reloginRes.status).toBe(403);
    expect((await reloginRes.json() as { errors: string }).errors).toContain("削除済み");
  });

  it("パスワードが間違っていれば削除済みでも 401", async () => {
    const cookie = await registerAndLogin("Deleted2", `deleted2${D}`);
    await app.request("/api/admin/account-delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ password: "Test@Password1!" }),
    });
    expect((await login(`deleted2${D}`, "WrongPass@1!")).status).toBe(401);
  });
});

// --- Account Recover ---

describe("POST /api/admin/account-recover", () => {
  it("30日以内なら復活できる", async () => {
    const cookie = await registerTwoOwners(`recover${D}`, `recover-co${D}`);
    await app.request("/api/admin/account-delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ password: "Test@Password1!" }),
    });

    const recoverRes = await app.request("/api/admin/account-recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `recover${D}`, password: "Test@Password1!" }),
    });
    expect(recoverRes.status).toBe(200);

    const newCookie = extractCookie(recoverRes.headers.get("set-cookie") ?? "");
    expect((await app.request("/api/admin/users", { headers: { Cookie: newCookie } })).status).toBe(200);
  });

  it("削除されていないアカウントは 400", async () => {
    await registerAndLogin("Active", `active${D}`);
    const res = await app.request("/api/admin/account-recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `active${D}`, password: "Test@Password1!" }),
    });
    expect(res.status).toBe(400);
  });

  it("パスワード誤りは 401", async () => {
    const cookie = await registerAndLogin("Recover2", `recover2${D}`);
    await app.request("/api/admin/account-delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ password: "Test@Password1!" }),
    });
    const res = await app.request("/api/admin/account-recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `recover2${D}`, password: "WrongPass@1!" }),
    });
    expect(res.status).toBe(401);
  });
});
