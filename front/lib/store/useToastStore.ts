// 画面をまたいで共有したいクライアント状態はZustandで書く。これがこのプロジェクトの標準。
// Context APIは「特定のコンポーネント配下だけで完結する」狭い用途(例: モーダル内だけのstep管理)に限定し、
// ページをまたぐ状態・複数画面から更新される状態には使わない。
//
// 注意: ログイン中ユーザー情報のようにサーバーが真実の源であるデータは、
// front/lib/auth.ts (getCurrentUser/requireAuth) 経由でServer Componentから取得する。
// Zustandストアに複製しない(クッキーの状態とズレて事故る原因になる)。
//
// 新しいストアを追加する場合もこのファイルと同じ形(create<State>()(set => ({...})))に揃えること。

import { create } from "zustand";

type Toast = {
	id: string;
	message: string;
	variant: "success" | "error";
};

type ToastState = {
	toasts: Toast[];
	showToast: (message: string, variant?: Toast["variant"]) => void;
	dismissToast: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	showToast: (message, variant = "success") =>
		set((state) => ({
			toasts: [...state.toasts, { id: crypto.randomUUID(), message, variant }],
		})),
	dismissToast: (id) =>
		set((state) => ({
			toasts: state.toasts.filter((toast) => toast.id !== id),
		})),
}));
