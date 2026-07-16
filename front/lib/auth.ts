import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE_URL } from "./apiClient";

export type CurrentUser = {
	id: string;
	name: string;
	email: string;
	role: "owner" | "admin" | "member";
};

// Server Component/layout専用。HttpOnly Cookieはブラウザの fetch(credentials: "include") では
// SSR側に自動転送されないため、next/headers から読み取って Cookie ヘッダーとして明示的に転送する。
export async function getCurrentUser(): Promise<CurrentUser | null> {
	const cookieStore = await cookies();
	const token = cookieStore.get("token");
	if (!token) return null;

	const res = await fetch(`${API_BASE_URL}/api/admin/me`, {
		headers: { Cookie: `token=${token.value}` },
		cache: "no-store",
	});
	if (!res.ok) return null;

	const body = (await res.json()) as { success: boolean; data: CurrentUser };
	return body.data;
}

// 未ログインなら /login にリダイレクトする。保護したいページ/レイアウトの先頭で呼び出す。
export async function requireAuth(): Promise<CurrentUser> {
	const user = await getCurrentUser();
	if (!user) {
		redirect("/login");
	}
	return user;
}
