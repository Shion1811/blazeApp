// ロール機能統合テスト
import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import { cleanDb } from "./setup.js";
import { registerAndLogin, getUsers } from "./testHelpers.js";

const D = "@roles.test";

beforeEach(async () => {
  await cleanDb();
});

// --- requireOwner ---

describe("requireOwner", () => {
  it("owner はアクセス可能", async () => {
    const cookie = await registerAndLogin("Owner", `owner${D}`);
    const res = await app.request("/api/admin/users", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
  });

  it("member は 403", async () => {
    await registerAndLogin("Owner", `owner${D}`);
    const memberCookie = await registerAndLogin("Member", `member${D}`);
    expect((await app.request("/api/admin/users", { headers: { Cookie: memberCookie } })).status).toBe(403);
  });
});

// --- requireAdmin ---

describe("requireAdmin", () => {
  it("admin は問い合わせ管理にアクセス可能", async () => {
    const ownerCookie = await registerAndLogin("Owner", `owner${D}`);
    const memberCookie = await registerAndLogin("Member", `member${D}`);

    const users = await getUsers(ownerCookie);
    const memberId = users.find((u) => u.email === `member${D}`)?.id;
    expect(memberId).toBeTruthy();

    await app.request(`/api/admin/users/${memberId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({ role: "admin" }),
    });

    expect((await app.request("/api/inquiry", { headers: { Cookie: memberCookie } })).status).toBe(200);
  });

  it("member は問い合わせ管理に 403", async () => {
    await registerAndLogin("Owner", `owner${D}`);
    const memberCookie = await registerAndLogin("Member", `member${D}`);
    expect((await app.request("/api/inquiry", { headers: { Cookie: memberCookie } })).status).toBe(403);
  });

  it("member はニュース投稿に 403", async () => {
    await registerAndLogin("Owner", `owner${D}`);
    const memberCookie = await registerAndLogin("Member", `member2${D}`);
    const fd = new FormData();
    fd.append("title", "タイトル");
    fd.append("body", "本文です。本文です。本文です。");
    expect((await app.request("/api/news-post", { method: "POST", headers: { Cookie: memberCookie }, body: fd })).status).toBe(403);
  });
});

// --- ロール変更 ---

describe("PATCH /api/admin/users/:userId/role", () => {
  it("owner が member を admin に昇格できる", async () => {
    const ownerCookie = await registerAndLogin("Owner", `owner${D}`);
    await registerAndLogin("Member", `member${D}`);

    const users = await getUsers(ownerCookie);
    const memberId = users.find((u) => u.email === `member${D}`)?.id;
    expect(memberId).toBeTruthy();

    const res = await app.request(`/api/admin/users/${memberId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(200);

    const after = await getUsers(ownerCookie);
    expect(after.find((u) => u.email === `member${D}`)?.role).toBe("admin");
  });

  it("自分自身のロールは変更不可", async () => {
    const ownerCookie = await registerAndLogin("Owner", `owner${D}`);
    const users = await getUsers(ownerCookie);
    const ownerId = users.find((u) => u.email === `owner${D}`)?.id;
    expect(ownerId).toBeTruthy();

    const res = await app.request(`/api/admin/users/${ownerId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(400);
  });

  it("2人のownerがいるとき一方をadminに降格できる", async () => {
    const ownerCookie = await registerAndLogin("Owner", `owner${D}`);
    await registerAndLogin("Member", `member${D}`);

    const users = await getUsers(ownerCookie);
    const memberId = users.find((u) => u.email === `member${D}`)?.id;
    expect(memberId).toBeTruthy();

    // memberをownerに昇格（2人のownerになる）
    await app.request(`/api/admin/users/${memberId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({ role: "owner" }),
    });

    // memberをadminに戻す（ownerが2人いるため降格可能、自分自身ではなく別ユーザー）
    const res = await app.request(`/api/admin/users/${memberId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: ownerCookie },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(200);
  });
});

// --- 削除リクエスト ---

describe("owner による他者アカウント削除", () => {
  it("owner が 1人のとき即時ソフトデリートされる", async () => {
    const ownerCookie = await registerAndLogin("Owner", `owner${D}`);
    await registerAndLogin("Target", `target${D}`);

    const users = await getUsers(ownerCookie);
    const targetId = users.find((u) => u.email === `target${D}`)?.id;
    expect(targetId).toBeTruthy();

    const res = await app.request(`/api/admin/users/${targetId}/delete-request`, {
      method: "POST",
      headers: { Cookie: ownerCookie },
    });
    expect(res.status).toBe(200);
    expect((await res.json() as { message: string }).message).toContain("削除しました");
  });

  it("自分自身は delete-request 不可", async () => {
    const ownerCookie = await registerAndLogin("Owner", `owner${D}`);
    const users = await getUsers(ownerCookie);
    const ownerId = users.find((u) => u.email === `owner${D}`)?.id;
    expect(ownerId).toBeTruthy();

    const res = await app.request(`/api/admin/users/${ownerId}/delete-request`, {
      method: "POST",
      headers: { Cookie: ownerCookie },
    });
    expect(res.status).toBe(400);
  });

  it("owner が 2人のとき非ownerの削除には承認が必要", async () => {
    const owner1Cookie = await registerAndLogin("Owner1", `owner1${D}`);
    await registerAndLogin("Member", `member${D}`);
    await registerAndLogin("Target", `target2${D}`); // 削除対象（memberのまま）

    const users = await getUsers(owner1Cookie);
    const memberId = users.find((u) => u.email === `member${D}`)?.id;
    const targetId = users.find((u) => u.email === `target2${D}`)?.id;
    expect(memberId).toBeTruthy();
    expect(targetId).toBeTruthy();

    // member を owner に昇格（2人のownerになる）
    await app.request(`/api/admin/users/${memberId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({ role: "owner" }),
    });

    // owner1 が target(member) を削除リクエスト
    // owner2(member)の承認も必要 → 承認待ち
    const reqRes = await app.request(`/api/admin/users/${targetId}/delete-request`, {
      method: "POST",
      headers: { Cookie: owner1Cookie },
    });
    expect(reqRes.status).toBe(200);
    expect((await reqRes.json() as { message: string }).message).toContain("承認");
  });
});

// --- 自己削除（owner保護） ---

describe("owner の自己削除", () => {
  it("owner が1人の場合は自己削除できない", async () => {
    const cookie = await registerAndLogin("Solo", `solo${D}`);
    const res = await app.request("/api/admin/account-delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ password: "Test@Password1!" }),
    });
    expect(res.status).toBe(400);

    // 削除されていないのでCookieは引き続き有効
    expect((await app.request("/api/admin/users", { headers: { Cookie: cookie } })).status).toBe(200);
  });

  it("owner が複数いれば自己削除できる", async () => {
    const owner1Cookie = await registerAndLogin("Owner1", `sowner1${D}`);
    const memberCookie = await registerAndLogin("Member", `smember${D}`);

    const users = await getUsers(owner1Cookie);
    const memberId = users.find((u) => u.email === `smember${D}`)?.id;
    expect(memberId).toBeTruthy();

    // member を owner に昇格（2人のownerになる）
    const roleRes = await app.request(`/api/admin/users/${memberId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({ role: "owner" }),
    });
    if (roleRes.status !== 200) {
      const body = await roleRes.text();
      throw new Error(`role update failed: ${roleRes.status} ${body}`);
    }

    const res = await app.request("/api/admin/account-delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({ password: "Test@Password1!" }),
    });
    expect(res.status).toBe(200);
    expect((await app.request("/api/admin/users", { headers: { Cookie: owner1Cookie } })).status).toBe(401);

    // memberCookieは引き続き有効（唯一のactive ownerとして残る）
    expect((await app.request("/api/admin/users", { headers: { Cookie: memberCookie } })).status).toBe(200);
  });
});
