// back/src/db/schema.ts の VALIDATION_LIMITS が唯一の定義元。
// このファイルが読む limits.generated.json は back で
//   npm run sync:validation
// を実行すると再生成される自動生成ファイルです。手で編集しないでください。
// back側の文字数上限などを変更したら、必ず back で sync:validation を実行し、
// 生成された limits.generated.json ごとコミットしてください。

import limits from "./limits.generated.json";

export const VALIDATION_LIMITS = limits as {
	email: { max: number };
	password: { min: number; max: number };
	adminName: { min: number; max: number };
	title: { min: number; max: number };
	body: { min: number; max: number };
	category: { min: number; max: number };
	inquiryName: { min: number; max: number };
};
