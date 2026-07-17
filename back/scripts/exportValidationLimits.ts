// back の VALIDATION_LIMITS (src/db/schema.ts) を front から参照できる形で書き出すスクリプト。
// back の zod スキーマを front で複製しないための「単一の定義元→生成物」の仕組み。
//
// 実行: npm run sync:validation
// back側でVALIDATION_LIMITSの数値を変更したら必ず実行し、生成物ごとコミットすること。

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { VALIDATION_LIMITS } from "../src/db/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../../front/lib/validation/limits.generated.json");

// JSONにコメントは書けないため、自動生成である旨はfront/lib/validation/limits.tsの側に明記する。
writeFileSync(outPath, JSON.stringify(VALIDATION_LIMITS, null, 2) + "\n");

console.log(`✔ VALIDATION_LIMITS を書き出しました: ${outPath}`);
