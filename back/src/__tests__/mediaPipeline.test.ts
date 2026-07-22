// 変換パイプライン自体の単体テスト（RAW→WebP変換・画像圧縮・動画圧縮・バリデーション）
// src/utils/media.ts が対象。API経由の統合テスト（gameImg.test.ts等）はモック画像を1枚通すだけで、
// このパイプライン自体の分岐（RAW抽出・リサイズ挙動・動画圧縮・バリデーション境界値）は未検証だった。
import { describe, it, expect, vi, beforeAll } from "vitest";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import {
  validateFileExtension,
  isValidImageExtension,
  isValidVideoExtension,
  isRawImageExtension,
  validateFileSize,
  validateRawFileSize,
  validateMultipleFiles,
  compressImage,
  compressVideo,
  extractRawPreview,
  sanitizeHtml,
} from "../utils/media.js";

ffmpeg.setFfmpegPath(ffmpegPath);

vi.mock("exifr", () => ({
  thumbnail: vi.fn(),
}));

function fakeFile(size: number, name = "a.png"): File {
  return { name, size } as unknown as File;
}

describe("validateFileExtension", () => {
  it("許可リストに含まれる拡張子はtrue", () => {
    expect(validateFileExtension("photo.png", ["png", "jpg"])).toBe(true);
  });

  it("大文字小文字を区別しない", () => {
    expect(validateFileExtension("photo.PNG", ["png"])).toBe(true);
  });

  it("許可リストにない拡張子はfalse", () => {
    expect(validateFileExtension("photo.gif", ["png", "jpg"])).toBe(false);
  });

  it("拡張子がないファイル名はfalse", () => {
    expect(validateFileExtension("photo", ["png"])).toBe(false);
  });
});

describe("isValidImageExtension / isValidVideoExtension / isRawImageExtension", () => {
  it.each([
    ["photo.jpg", true],
    ["photo.jpeg", true],
    ["photo.png", true],
    ["photo.webp", true],
    ["photo.heic", true],
    ["photo.cr2", true],
    ["photo.mp4", false],
    ["photo", false],
  ])("isValidImageExtension(%s) -> %s", (name, expected) => {
    expect(isValidImageExtension(name)).toBe(expected);
  });

  it.each([
    ["video.mp4", true],
    ["video.mov", true],
    ["video.avi", false],
    ["video.png", false],
  ])("isValidVideoExtension(%s) -> %s", (name, expected) => {
    expect(isValidVideoExtension(name)).toBe(expected);
  });

  it.each([
    ["photo.cr3", true],
    ["photo.cr2", true],
    ["photo.arw", true],
    ["photo.nef", true],
    ["photo.raf", true],
    ["photo.dng", true],
    ["photo.jpg", false],
  ])("isRawImageExtension(%s) -> %s", (name, expected) => {
    expect(isRawImageExtension(name)).toBe(expected);
  });
});

describe("validateFileSize / validateRawFileSize", () => {
  it("通常画像は10MBちょうどまでOK", () => {
    expect(validateFileSize(10 * 1024 * 1024)).toBe(true);
  });

  it("通常画像は10MBを1byteでも超えるとNG", () => {
    expect(validateFileSize(10 * 1024 * 1024 + 1)).toBe(false);
  });

  it("RAWは50MBちょうどまでOK", () => {
    expect(validateRawFileSize(50 * 1024 * 1024)).toBe(true);
  });

  it("RAWは50MBを1byteでも超えるとNG", () => {
    expect(validateRawFileSize(50 * 1024 * 1024 + 1)).toBe(false);
  });
});

describe("validateMultipleFiles", () => {
  it("10枚以下・合計100MB以下・個別10MB以下ならnull", () => {
    const files = Array.from({ length: 10 }, (_, i) => fakeFile(1024, `f${i}.png`));
    expect(validateMultipleFiles(files)).toBeNull();
  });

  it("11枚以上は枚数エラー", () => {
    const files = Array.from({ length: 11 }, (_, i) => fakeFile(1024, `f${i}.png`));
    expect(validateMultipleFiles(files)).toContain("最大10枚");
  });

  it("合計サイズが100MBを超えると合計サイズエラー", () => {
    const files = [fakeFile(60 * 1024 * 1024, "a.png"), fakeFile(60 * 1024 * 1024, "b.png")];
    expect(validateMultipleFiles(files)).toContain("合計サイズ");
  });

  it("個別ファイルが10MBを超えると個別サイズエラー", () => {
    const files = [fakeFile(11 * 1024 * 1024, "big.png")];
    expect(validateMultipleFiles(files)).toContain("big.png");
  });
});

describe("compressImage", () => {
  it("画像をWebP形式に変換する", async () => {
    const src = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer();

    const result = await compressImage(src);

    expect(result.contentType).toBe("image/webp");
    expect(result.extension).toBe("webp");
    const meta = await sharp(result.data).metadata();
    expect(meta.format).toBe("webp");
  });

  it("1920pxを超える画像は1920px以内に縮小される", async () => {
    const src = await sharp({
      create: { width: 3000, height: 1000, channels: 3, background: { r: 0, g: 255, b: 0 } },
    }).png().toBuffer();

    const result = await compressImage(src);
    const meta = await sharp(result.data).metadata();

    expect(meta.width).toBeLessThanOrEqual(1920);
    expect(meta.height).toBeLessThanOrEqual(1920);
  });

  it("1920px以下の画像は拡大されない", async () => {
    const src = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 255 } },
    }).png().toBuffer();

    const result = await compressImage(src);
    const meta = await sharp(result.data).metadata();

    expect(meta.width).toBe(10);
    expect(meta.height).toBe(10);
  });

  it("画像として解釈できないバッファはエラーを投げる", async () => {
    await expect(compressImage(Buffer.from("not an image"))).rejects.toThrow(
      "画像のWebP変換に失敗しました",
    );
  });
});

describe("extractRawPreview", () => {
  it("埋め込みJPEGプレビューが取得できればBufferを返す", async () => {
    const { thumbnail } = await import("exifr");
    vi.mocked(thumbnail).mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

    const result = await extractRawPreview(Buffer.from("dummy raw bytes"));

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from([1, 2, 3]));
  });

  it("プレビューが存在しない場合はエラーを投げる", async () => {
    const { thumbnail } = await import("exifr");
    vi.mocked(thumbnail).mockResolvedValueOnce(undefined);

    await expect(extractRawPreview(Buffer.from("dummy raw bytes"))).rejects.toThrow(
      "JPEGプレビューを抽出できませんでした",
    );
  });

  it("プレビューが空バッファの場合もエラーを投げる", async () => {
    const { thumbnail } = await import("exifr");
    vi.mocked(thumbnail).mockResolvedValueOnce(new Uint8Array(0));

    await expect(extractRawPreview(Buffer.from("dummy raw bytes"))).rejects.toThrow(
      "JPEGプレビューを抽出できませんでした",
    );
  });
});

describe("compressVideo", () => {
  let sourceVideo: Buffer;

  beforeAll(async () => {
    const outputPath = join(tmpdir(), `media-pipeline-src-${randomUUID()}.mp4`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input("color=c=blue:s=64x64:d=1:r=10")
        .inputFormat("lavfi")
        .outputOptions(["-c:v libx264", "-pix_fmt yuv420p"])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", reject)
        .run();
    });
    sourceVideo = await readFile(outputPath);
    await unlink(outputPath).catch(() => {});
  }, 30000);

  it("動画をMP4形式に圧縮する", async () => {
    const result = await compressVideo(sourceVideo);

    expect(result.contentType).toBe("video/mp4");
    expect(result.extension).toBe("mp4");
    // MP4コンテナのシグネチャ（ftypボックス）を確認
    expect(result.data.subarray(4, 8).toString("ascii")).toBe("ftyp");
  }, 30000);

  it("動画として解釈できないバッファはエラーになる", async () => {
    await expect(compressVideo(Buffer.from("not a video"))).rejects.toBeTruthy();
  }, 30000);
});

describe("sanitizeHtml", () => {
  it("HTMLタグをエスケープする", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;",
    );
  });

  it("&, \", ' をそれぞれエスケープする", () => {
    expect(sanitizeHtml(`a & b " c ' d`)).toBe("a &amp; b &quot; c &#x27; d");
  });
});
