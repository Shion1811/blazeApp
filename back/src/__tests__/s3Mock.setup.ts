// S3への実アクセスを防ぐグローバルモック。
// isolate:false でモジュールキャッシュが全テストファイル間で共有されるため、
// 個別のテストファイル内でvi.mockしても、それより先に評価される他ファイル
// （例: achievement.test.ts）が未モックのdb/s3.jsを先に読み込んでしまうと
// 効かなくなる。setupFilesとして全テストファイルより前に登録することで防ぐ。
import { vi } from "vitest";

vi.mock("../db/s3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/s3.js")>();
  return {
    ...actual,
    uploadToS3: vi.fn(async () => {}),
    deleteFromS3: vi.fn(async () => {}),
    downloadFromS3: vi.fn(async () => Buffer.from("")),
    getPresignedDownloadUrl: vi.fn(
      async (key: string) => `https://mock-s3.test/${key}`,
    ),
  };
});
