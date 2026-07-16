type RequestConfig = RequestInit & {
	params?: Record<string, string | number>;
	timeout?: number;
};

// backのベースURL。Server Component側（front/lib/auth.ts）とも共有する単一の定義元
export const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export class ApiError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

export const apiClient = async <T>(
	endpoint: string,
	config: RequestConfig = {},
): Promise<T> => {
	const { params, timeout = 10000, headers, ...customConfig } = config;

	const url = new URL(`${API_BASE_URL}${endpoint}`);
	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			url.searchParams.append(key, String(value));
		});
	}

	const defaultHeaders: HeadersInit = {
		"Content-Type": "application/json",
		...headers,
	};

	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url.toString(), {
			...customConfig,
			headers: defaultHeaders,
			// バックエンドはJWTをHttpOnly Cookieでのみ発行し、レスポンスボディやlocalStorageには一切載せない
			// （back/src/admin/login.ts参照）。CORSもcredentials:trueなので、認証にはCookie送信が必須。
			credentials: "include",
			signal: controller.signal,
		});

		clearTimeout(id);

		if (!response.ok) {
			if (response.status === 401 && typeof window !== "undefined") {
				window.location.href = "/login";
			}
			throw new ApiError(`API Error: ${response.statusText}`, response.status);
		}

		if (response.status === 204) {
			return {} as T;
		}

		return await response.json();
	} catch (error) {
		clearTimeout(id);
		if (error instanceof DOMException && error.name === "AbortError") {
			throw new Error("Request timeout");
		}
		throw error;
	}
};
