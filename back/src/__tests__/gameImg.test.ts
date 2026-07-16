// 試合風景API CRUD統合テスト
// uploadToS3 / deleteFromS3 は実際のAWSに繋がず、テスト用にモックする
import { describe, it, expect, beforeEach, vi } from "vitest";
import { app } from "../app.js";
import { cleanDb, testPool } from "./setup.js";
import { registerAndLogin } from "./testHelpers.js";

vi.mock("../db/s3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/s3.js")>();
  return {
    ...actual,
    uploadToS3: vi.fn(async () => {}),
    deleteFromS3: vi.fn(async () => {}),
  };
});

const D = "@gameImg.test";

// 1x1 透明PNG（実データなのでsharpでの圧縮処理を通せる）
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function pngFile(name = "photo.png") {
  return new File([PNG_1X1], name, { type: "image/png" });
}

async function postGameImg(cookie: string) {
  const fd = new FormData();
  fd.append("image", pngFile());
  return app.request("/api/gameImg", { method: "POST", headers: { Cookie: cookie }, body: fd });
}

beforeEach(async () => {
  await cleanDb();
});

describe("POST /api/gameImg", () => {
  it("owner は画像付きで作成できる", async () => {
    const cookie = await registerAndLogin("Owner", `owner${D}`);
    const res = await postGameImg(cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBeTruthy();
  });

  it("画像なしは400", async () => {
    const cookie = await registerAndLogin("Owner", `owner2${D}`);
    const res = await app.request("/api/gameImg", { method: "POST", headers: { Cookie: cookie }, body: new FormData() });
    expect(res.status).toBe(400);
  });

  it("member は 403", async () => {
    await registerAndLogin("Owner", `owner3${D}`);
    const memberCookie = await registerAndLogin("Member", `member3${D}`);
    expect((await postGameImg(memberCookie)).status).toBe(403);
  });

  it("認証なしは 401", async () => {
    const fd = new FormData();
    fd.append("image", pngFile());
    expect((await app.request("/api/gameImg", { method: "POST", body: fd })).status).toBe(401);
  });

  it("許可されていない拡張子は400", async () => {
    const cookie = await registerAndLogin("Owner", `owner4${D}`);
    const fd = new FormData();
    fd.append("image", new File([PNG_1X1], "photo.exe", { type: "application/octet-stream" }));
    const res = await app.request("/api/gameImg", { method: "POST", headers: { Cookie: cookie }, body: fd });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/gameImg — 公開範囲", () => {
  it("作成直後（未承認）は一般公開では見えない", async () => {
    const cookie = await registerAndLogin("Owner", `owner5${D}`);
    await postGameImg(cookie);

    const publicRes = await app.request("/api/gameImg");
    const publicBody = await publicRes.json() as { data: unknown[] };
    expect(publicBody.data).toHaveLength(0);
  });

  it("作成直後でも管理者には見える", async () => {
    const cookie = await registerAndLogin("Owner", `owner6${D}`);
    await postGameImg(cookie);

    const adminRes = await app.request("/api/gameImg", { headers: { Cookie: cookie } });
    const adminBody = await adminRes.json() as { data: unknown[] };
    expect(adminBody.data).toHaveLength(1);
  });

  it("承認後は一般公開でも見える", async () => {
    const cookie = await registerAndLogin("Owner", `owner7${D}`);
    await postGameImg(cookie);

    await testPool.query(`UPDATE images SET consent_status = 'approved'`);

    const publicRes = await app.request("/api/gameImg");
    const publicBody = await publicRes.json() as { data: unknown[] };
    expect(publicBody.data).toHaveLength(1);
  });
});

describe("GET /api/gameImg/:id", () => {
  it("存在しないIDは404", async () => {
    const res = await app.request("/api/gameImg/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("未承認画像しかない場合、一般公開では404", async () => {
    const cookie = await registerAndLogin("Owner", `owner8${D}`);
    const postRes = await postGameImg(cookie);
    const postBody = await postRes.json() as { data: { id: string } };

    const res = await app.request(`/api/gameImg/${postBody.data.id}`);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/gameImg/images/:imageId/consent", () => {
  it("owner は承認ステータスを更新できる", async () => {
    const cookie = await registerAndLogin("Owner", `owner9${D}`);
    await postGameImg(cookie);
    const { rows } = await testPool.query(`SELECT id FROM images LIMIT 1`);
    const imageId = rows[0].id as string;

    const res = await app.request(`/api/gameImg/images/${imageId}/consent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ consent_status: "approved" }),
    });
    expect(res.status).toBe(200);
  });

  it("不正なconsent_statusは400", async () => {
    const cookie = await registerAndLogin("Owner", `owner10${D}`);
    await postGameImg(cookie);
    const { rows } = await testPool.query(`SELECT id FROM images LIMIT 1`);
    const imageId = rows[0].id as string;

    const res = await app.request(`/api/gameImg/images/${imageId}/consent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ consent_status: "invalid" }),
    });
    expect(res.status).toBe(400);
  });

  it("member は 403", async () => {
    const ownerCookie = await registerAndLogin("Owner", `owner11${D}`);
    const memberCookie = await registerAndLogin("Member", `member11${D}`);
    await postGameImg(ownerCookie);
    const { rows } = await testPool.query(`SELECT id FROM images LIMIT 1`);
    const imageId = rows[0].id as string;

    const res = await app.request(`/api/gameImg/images/${imageId}/consent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: memberCookie },
      body: JSON.stringify({ consent_status: "approved" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/gameImg/:id/:imageId — 画像差し替え", () => {
  it("owner は画像を差し替えられる", async () => {
    const cookie = await registerAndLogin("Owner", `owner12${D}`);
    const postRes = await postGameImg(cookie);
    const postBody = await postRes.json() as { data: { id: string } };
    const { rows } = await testPool.query(`SELECT id FROM images WHERE game_id = $1`, [postBody.data.id]);
    const imageId = rows[0].id as string;

    const fd = new FormData();
    fd.append("image", pngFile("new.png"));
    const res = await app.request(`/api/gameImg/${postBody.data.id}/${imageId}`, {
      method: "PATCH",
      headers: { Cookie: cookie },
      body: fd,
    });
    expect(res.status).toBe(200);
  });

  it("画像未指定は400", async () => {
    const cookie = await registerAndLogin("Owner", `owner13${D}`);
    const postRes = await postGameImg(cookie);
    const postBody = await postRes.json() as { data: { id: string } };
    const { rows } = await testPool.query(`SELECT id FROM images WHERE game_id = $1`, [postBody.data.id]);
    const imageId = rows[0].id as string;

    const res = await app.request(`/api/gameImg/${postBody.data.id}/${imageId}`, {
      method: "PATCH",
      headers: { Cookie: cookie },
      body: new FormData(),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/gameImg/:id", () => {
  it("owner は削除できる", async () => {
    const cookie = await registerAndLogin("Owner", `owner14${D}`);
    const postRes = await postGameImg(cookie);
    const postBody = await postRes.json() as { data: { id: string } };

    const res = await app.request(`/api/gameImg/${postBody.data.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);

    const getRes = await app.request(`/api/gameImg/${postBody.data.id}`, { headers: { Cookie: cookie } });
    expect(getRes.status).toBe(404);
  });

  it("member は 403", async () => {
    const ownerCookie = await registerAndLogin("Owner", `owner15${D}`);
    const memberCookie = await registerAndLogin("Member", `member15${D}`);
    const postRes = await postGameImg(ownerCookie);
    const postBody = await postRes.json() as { data: { id: string } };

    const res = await app.request(`/api/gameImg/${postBody.data.id}`, {
      method: "DELETE",
      headers: { Cookie: memberCookie },
    });
    expect(res.status).toBe(403);
  });

  it("存在しないIDは404", async () => {
    const cookie = await registerAndLogin("Owner", `owner16${D}`);
    const res = await app.request("/api/gameImg/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });
});
