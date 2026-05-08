import { defineConfig } from "drizzle-kit";

export default defineConfig({
  //   スキーマの場所
  schema: "./src/db/schema.ts",
  //   マイグレーションファイルの出力先
  out: "./drizzle",
  //   どのdbを使用するか選択
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
