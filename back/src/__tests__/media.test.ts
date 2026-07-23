// メディア情報API CRUD統合テスト（news-postと同じnewsテーブルをtypeで分けて使用）
import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import { cleanDb } from "./setup.js";
import { registerAndLogin } from "./testHelpers.js";

const D = "@media.test";

beforeEach(async () => {
  await cleanDb();
});

function mediaForm(title: string, body: string) {
  const fd = new FormData();
  fd.append("title", title);
  fd.append("body", body);
  return fd;
}

const ORIGIN = "http://localhost:3000";

async function postMedia(cookie: string, title: string, body: string) {
  return app.request("/api/media", {
    method: "POST",
    headers: { Cookie: cookie, Origin: ORIGIN },
    body: mediaForm(title, body),
  });
}

describe("POST /api/media", () => {
  it("owner はメディア情報を作成できる", async () => {
    const cookie = await registerAndLogin("Owner", `owner${D}`);
    const res = await postMedia(cookie, "タイトル", "本文です。本文です。");
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { title: string } };
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("タイトル");
  });

  it("member は 403", async () => {
    await registerAndLogin("Owner", `owner${D}`);
    const memberCookie = await registerAndLogin("Member", `member${D}`);
    expect((await postMedia(memberCookie, "タイトル", "本文です。本文です。")).status).toBe(403);
  });

  it("認証なしは 401", async () => {
    const res = await app.request("/api/media", {
      method: "POST",
      headers: { Origin: ORIGIN },
      body: mediaForm("タイトル", "本文です。本文です。"),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/media", () => {
  it("一覧を取得できる（認証不要）", async () => {
    const cookie = await registerAndLogin("Owner", `owner2${D}`);
    await postMedia(cookie, "タイトルA", "本文です。本文です。");

    const res = await app.request("/api/media");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ title: string }> };
    expect(body.data).toHaveLength(1);
  });

  it("news-postとmediaは互いのデータを含まない", async () => {
    const cookie = await registerAndLogin("Owner", `owner3${D}`);

    const newsFd = new FormData();
    newsFd.append("title", "ニュースタイトル");
    newsFd.append("body", "ニュース本文です。ニュース本文です。");
    await app.request("/api/news-post", {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: newsFd,
    });

    await postMedia(cookie, "メディアタイトル", "メディア本文です。メディア本文です。");

    const mediaRes = await app.request("/api/media");
    const mediaBody = await mediaRes.json() as { data: Array<{ title: string }> };
    expect(mediaBody.data).toHaveLength(1);
    expect(mediaBody.data[0]?.title).toBe("メディアタイトル");

    const newsRes = await app.request("/api/news-post");
    const newsBody = await newsRes.json() as { data: Array<{ title: string }> };
    expect(newsBody.data).toHaveLength(1);
    expect(newsBody.data[0]?.title).toBe("ニュースタイトル");
  });
});

describe("GET /api/media/:id", () => {
  it("1件取得できる", async () => {
    const cookie = await registerAndLogin("Owner", `owner4${D}`);
    const postRes = await postMedia(cookie, "タイトル", "本文です。本文です。");
    const postBody = await postRes.json() as { data: { id: string } };

    const res = await app.request(`/api/media/${postBody.data.id}`);
    expect(res.status).toBe(200);
  });

  it("news-postのIDでmediaを取得すると404", async () => {
    const cookie = await registerAndLogin("Owner", `owner5${D}`);
    const newsFd = new FormData();
    newsFd.append("title", "ニュースタイトル");
    newsFd.append("body", "ニュース本文です。ニュース本文です。");
    const newsRes = await app.request("/api/news-post", {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: newsFd,
    });
    const newsBody = await newsRes.json() as { data: { id: string } };

    const res = await app.request(`/api/media/${newsBody.data.id}`);
    expect(res.status).toBe(404);
  });

  it("存在しないIDは404", async () => {
    const res = await app.request("/api/media/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/media/:id", () => {
  it("owner は更新できる", async () => {
    const cookie = await registerAndLogin("Owner", `owner6${D}`);
    const postRes = await postMedia(cookie, "旧タイトル", "本文です。本文です。");
    const postBody = await postRes.json() as { data: { id: string } };

    const fd = new FormData();
    fd.append("title", "新タイトル");
    const res = await app.request(`/api/media/${postBody.data.id}`, {
      method: "PATCH",
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: fd,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { title: string } };
    expect(body.data.title).toBe("新タイトル");
  });

  it("member は 403", async () => {
    const ownerCookie = await registerAndLogin("Owner", `owner7${D}`);
    const memberCookie = await registerAndLogin("Member", `member7${D}`);
    const postRes = await postMedia(ownerCookie, "タイトル", "本文です。本文です。");
    const postBody = await postRes.json() as { data: { id: string } };

    const fd = new FormData();
    fd.append("title", "新タイトル");
    const res = await app.request(`/api/media/${postBody.data.id}`, {
      method: "PATCH",
      headers: { Cookie: memberCookie, Origin: ORIGIN },
      body: fd,
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/media/:id", () => {
  it("owner は削除できる", async () => {
    const cookie = await registerAndLogin("Owner", `owner8${D}`);
    const postRes = await postMedia(cookie, "タイトル", "本文です。本文です。");
    const postBody = await postRes.json() as { data: { id: string } };

    const res = await app.request(`/api/media/${postBody.data.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: ORIGIN },
    });
    expect(res.status).toBe(200);

    const getRes = await app.request(`/api/media/${postBody.data.id}`);
    expect(getRes.status).toBe(404);
  });

  it("member は 403", async () => {
    const ownerCookie = await registerAndLogin("Owner", `owner9${D}`);
    const memberCookie = await registerAndLogin("Member", `member9${D}`);
    const postRes = await postMedia(ownerCookie, "タイトル", "本文です。本文です。");
    const postBody = await postRes.json() as { data: { id: string } };

    const res = await app.request(`/api/media/${postBody.data.id}`, {
      method: "DELETE",
      headers: { Cookie: memberCookie },
    });
    expect(res.status).toBe(403);
  });
});
