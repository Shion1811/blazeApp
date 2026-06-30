import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 30000,
    // テストファイルを直列実行（DB状態の競合を防ぐ）
    fileParallelism: false,
    // モジュールを共有（DBプールを1つに保ち、db pool が複数作成される問題を回避）
    isolate: false,
    // マイグレーションをテスト全体で1回だけ実行
    globalSetup: "./src/__tests__/globalSetup.ts",
  },
});
