// テスト共通ヘルパー関数

import { app } from "../app.js";

/**
 * Set-Cookie レスポンスヘッダから Cookie リクエストヘッダ用の "token=xxx" 文字列を抽出する。
 * ブラウザは Set-Cookie 属性（HttpOnly, Secure 等）を Cookie ヘッダに含めないため、
 * テストでも同様に純粋な "token=value" だけを送信する。
 */
export function extractCookie(setCookieHeader: string): string {
  const match = setCookieHeader.match(/token=[^;]*/);
  return match ? match[0] : "";
}

/** ユーザー登録してログインし、Cookie 文字列を返す */
export async function registerAndLogin(
  name: string,
  email: string,
  pw = "Test@Password1!",
): Promise<string> {
  const regRes = await app.request("/api/admin/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password: pw, passwordConfirmation: pw }),
  });
  if (regRes.status !== 200) {
    const body = await regRes.text();
    throw new Error(`register failed: ${regRes.status} ${body}`);
  }

  const loginRes = await app.request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  });
  if (loginRes.status !== 200) {
    const body = await loginRes.text();
    throw new Error(`login failed: ${loginRes.status} ${body}`);
  }

  return extractCookie(loginRes.headers.get("set-cookie") ?? "");
}

/** GET /api/admin/users を呼び出してユーザー一覧を返す */
export async function getUsers(cookie: string) {
  const res = await app.request("/api/admin/users", { headers: { Cookie: cookie } });
  if (res.status !== 200) {
    const body = await res.text();
    throw new Error(`getUsers failed: ${res.status} ${body}`);
  }
  const body = await res.json() as { data: Array<{ id: string; email: string; role: string }> };
  return body.data;
}
