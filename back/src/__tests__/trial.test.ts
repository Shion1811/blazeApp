// 体験申し込みAPI 統合テスト
import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import { cleanDb } from "./setup.js";
import { registerAndLogin } from "./testHelpers.js";

const D = "@trial.test";
const ORIGIN = "http://localhost:3000";

beforeEach(async () => {
  await cleanDb();
});

function validFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const fields: Record<string, string> = {
    email: "trial-user@example.com",
    trial_date: "2026-08-01",
    name: "山田太郎",
    furigana: "ヤマダタロウ",
    gender: "male",
    birth_date: "2012-04-01",
    school_name: "西尾市立西尾中学校",
    phone_number: "090-1234-5678",
    motivation: "instagram",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return fd;
}

describe("POST /api/trial-application", () => {
  it("必須項目を満たしていれば誰でも送信できる", async () => {
    const res = await app.request("/api/trial-application", {
      method: "POST",
      headers: { Origin: ORIGIN },
      body: validFormData(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBeTruthy();
  });

  it("塾・紹介者名は未入力でも送信できる（任意項目）", async () => {
    const res = await app.request("/api/trial-application", {
      method: "POST",
      headers: { Origin: ORIGIN },
      body: validFormData({ motivation: "referral" }),
    });
    expect(res.status).toBe(200);
  });

  it("必須項目（電話番号）が欠けている場合は400", async () => {
    const fd = validFormData();
    fd.delete("phone_number");
    const res = await app.request("/api/trial-application", {
      method: "POST",
      headers: { Origin: ORIGIN },
      body: fd,
    });
    expect(res.status).toBe(400);
  });

  it("きっかけが「その他」なのに内容未入力の場合は400", async () => {
    const res = await app.request("/api/trial-application", {
      method: "POST",
      headers: { Origin: ORIGIN },
      body: validFormData({ motivation: "other" }),
    });
    expect(res.status).toBe(400);
  });

  it("きっかけが「その他」で内容を入力していれば200", async () => {
    const res = await app.request("/api/trial-application", {
      method: "POST",
      headers: { Origin: ORIGIN },
      body: validFormData({ motivation: "other", motivation_other: "友人に誘われて" }),
    });
    expect(res.status).toBe(200);
  });

  it("フリガナが全角カタカナでない場合は400", async () => {
    const res = await app.request("/api/trial-application", {
      method: "POST",
      headers: { Origin: ORIGIN },
      body: validFormData({ furigana: "やまだたろう" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("体験申し込み一覧の権限", () => {
  it("一覧取得は認証が必要", async () => {
    expect((await app.request("/api/trial-application")).status).toBe(401);
  });

  it("owner は一覧・詳細を取得できる", async () => {
    const cookie = await registerAndLogin("Owner", `owner${D}`);

    const createRes = await app.request("/api/trial-application", {
      method: "POST",
      headers: { Origin: ORIGIN },
      body: validFormData(),
    });
    const created = (await createRes.json()) as { data: { id: string } };

    const listRes = await app.request("/api/trial-application", {
      headers: { Cookie: cookie },
    });
    expect(listRes.status).toBe(200);

    const detailRes = await app.request(`/api/trial-application/${created.data.id}`, {
      headers: { Cookie: cookie },
    });
    expect(detailRes.status).toBe(200);
  });
});
