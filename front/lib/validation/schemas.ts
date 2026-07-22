// back/src/db/schema.ts のzodスキーマと同じ制約値(VALIDATION_LIMITS)を使ってfront用のzodスキーマを組み立てる。
// 「同じ制約をfrontのフォームにも入れたい」場合は、ここに無ければ追加し、
// 独自にz.string().max(...)などを画面ごとに書かないこと。
// 制約値そのものを変えたい場合はback側(VALIDATION_LIMITS)を直し、npm run sync:validationで反映する。

import { z } from "zod";
import { VALIDATION_LIMITS } from "./limits";

const stringField = (min: number, max: number, label: string) =>
	z
		.string()
		.trim()
		.min(min, `${label}を入力してください。`)
		.max(max, `${label}は${max}文字以内で入力してください。`);

export const emailSchema = z
	.string()
	.email("メールアドレス形式が正しくありません。")
	.max(
		VALIDATION_LIMITS.email.max,
		`メールアドレスは${VALIDATION_LIMITS.email.max}文字以内で入力してください。`,
	);

export const passwordSchema = z
	.string()
	.min(
		VALIDATION_LIMITS.password.min,
		`パスワードは${VALIDATION_LIMITS.password.min}文字以上で入力してください。`,
	)
	.max(
		VALIDATION_LIMITS.password.max,
		`パスワードは${VALIDATION_LIMITS.password.max}文字以内で入力してください。`,
	);

export const adminNameSchema = stringField(
	VALIDATION_LIMITS.adminName.min,
	VALIDATION_LIMITS.adminName.max,
	"名前",
);

export const titleSchema = stringField(
	VALIDATION_LIMITS.title.min,
	VALIDATION_LIMITS.title.max,
	"タイトル",
);

export const bodySchema = stringField(
	VALIDATION_LIMITS.body.min,
	VALIDATION_LIMITS.body.max,
	"内容",
);

export const categorySchema = stringField(
	VALIDATION_LIMITS.category.min,
	VALIDATION_LIMITS.category.max,
	"カテゴリー",
);

export const inquiryNameSchema = stringField(
	VALIDATION_LIMITS.inquiryName.min,
	VALIDATION_LIMITS.inquiryName.max,
	"名前",
);
