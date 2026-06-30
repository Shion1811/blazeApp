// コンテンツ API 統合テスト（admin_name表示・権限確認）
import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import { cleanDb, testPool } from "./setup.js";
import { registerAndLogin } from "./testHelpers.js";

const D = "@content.test";

beforeEach(async () => {
  await cleanDb();
});

async function postNews(cookie: string, title: string, body: string) {
  const fd = new FormData();
  fd.append("title", title);
  fd.append("body", body);
  return app.request("/api/news-post", { method: "POST", headers: { Cookie: cookie }, body: fd });
}

// --- admin_name ---

describe("GET /api/news-post — admin_name", () => {
  it("投稿者名が admin_name として返る", async () => {
    const cookie = await registerAndLogin("テスト管理者", `news${D}`);
    expect((await postNews(cookie, "テストタイトル", "テスト本文です。テスト本文です。")).status).toBe(200);

    const res = await app.request("/api/news-post");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ admin_name: string }> };
    expect(body.data[0]?.admin_name).toBe("テスト管理者");
  });

  it("admin_id が null（削除済み管理者）のとき「元管理者」が返る", async () => {
    const cookie = await registerAndLogin("削除予定管理者", `todelete${D}`);
    expect((await postNews(cookie, "テストタイトル", "テスト本文です。テスト本文です。")).status).toBe(200);

    await testPool.query(`UPDATE news SET admin_id = NULL`);

    const res = await app.request("/api/news-post");
    const body = await res.json() as { data: Array<{ admin_name: string }> };
    expect(body.data[0]?.admin_name).toBe("元管理者");
  });
});

describe("GET /api/news-post/:id — admin_name", () => {
  it("1件取得でも admin_name が返る", async () => {
    const cookie = await registerAndLogin("管理者", `single${D}`);
    const postRes = await postNews(cookie, "タイトル", "本文です。本文です。本文です。");
    const postBody = await postRes.json() as { data: { id: string } };

    const res = await app.request(`/api/news-post/${postBody.data.id}`);
    expect(res.status).toBe(200);
    expect((await res.json() as { data: { admin_name: string } }).data.admin_name).toBe("管理者");
  });
});

// --- 書き込み権限 ---

describe("ニュース書き込み権限", () => {
  it("owner はニュース投稿可能", async () => {
    const cookie = await registerAndLogin("Owner", `owner${D}`);
    expect((await postNews(cookie, "ownerタイトル", "ownerの本文です。ownerの本文です。")).status).toBe(200);
  });

  it("member はニュース投稿 403", async () => {
    await registerAndLogin("Owner", `owner${D}`);
    const memberCookie = await registerAndLogin("Member", `member${D}`);
    expect((await postNews(memberCookie, "memberタイトル", "memberの本文。")).status).toBe(403);
  });

  it("認証なしはニュース投稿 401", async () => {
    const fd = new FormData();
    fd.append("title", "タイトル");
    fd.append("body", "本文です。");
    expect((await app.request("/api/news-post", { method: "POST", body: fd })).status).toBe(401);
  });
});

// --- 問い合わせ権限 ---

describe("問い合わせ権限", () => {
  it("誰でも問い合わせ送信可能", async () => {
    const fd = new FormData();
    fd.append("name", "お客様");
    fd.append("title", "お問い合わせタイトル");
    fd.append("body", "お問い合わせ本文です。");
    expect((await app.request("/api/inquiry", { method: "POST", body: fd })).status).toBe(200);
  });

  it("問い合わせ一覧は認証が必要", async () => {
    expect((await app.request("/api/inquiry")).status).toBe(401);
  });

  it("owner は問い合わせ一覧を取得できる", async () => {
    const cookie = await registerAndLogin("Owner", `owner2${D}`);
    expect((await app.request("/api/inquiry", { headers: { Cookie: cookie } })).status).toBe(200);
  });
});
