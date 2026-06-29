// メディア処理ユーティリティ（画像圧縮・動画圧縮・バリデーション）

import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

// FFmpegのパスを設定
ffmpeg.setFfmpegPath(ffmpegPath);

// 設計書に基づく許可拡張子
// RAW形式（cr3/cr2/arw/nef/raf/dng）は sharp 非対応のため LibRaw 対応まで除外（P2）
const ALLOWED_IMAGE_EXTENSIONS = [
  "jpeg",
  "jpg",
  "heic",
  "heif",
  "png",
  "webp",
];

const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov"];

// ファイルサイズ制限（設計書より）
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 1ファイル10MB
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 合計100MB
const MAX_FILE_COUNT = 10; // 最大10枚

/**
 * ファイルの拡張子をチェック
 * @param filename - ファイル名
 * @param allowedExtensions - 許可する拡張子の配列
 * @returns 有効ならtrue
 */
export function validateFileExtension(
  filename: string,
  allowedExtensions: string[],
): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return allowedExtensions.includes(ext);
}

/**
 * 画像の拡張子チェック
 */
export function isValidImageExtension(filename: string): boolean {
  return validateFileExtension(filename, ALLOWED_IMAGE_EXTENSIONS);
}

/**
 * 動画の拡張子チェック
 */
export function isValidVideoExtension(filename: string): boolean {
  return validateFileExtension(filename, ALLOWED_VIDEO_EXTENSIONS);
}

/**
 * ファイルサイズをチェック
 * @param size - ファイルサイズ（バイト）
 * @returns 10MB以下ならtrue
 */
export function validateFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * 複数ファイルの合計サイズと枚数をチェック
 */
export function validateMultipleFiles(files: File[]): string | null {
  if (files.length > MAX_FILE_COUNT) {
    return `ファイルは最大${MAX_FILE_COUNT}枚までです。`;
  }
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    return "ファイルの合計サイズは100MBまでです。";
  }
  for (const f of files) {
    if (!validateFileSize(f.size)) {
      return `ファイル「${f.name}」のサイズが10MBを超えています。`;
    }
  }
  return null; // エラーなし
}

/**
 * 画像をWebP形式に変換・圧縮
 * @param buffer - 元の画像データ
 * @returns 圧縮後のBufferとContent-Type
 */
export async function compressImage(
  buffer: Buffer,
): Promise<{ data: Buffer; contentType: string; extension: string }> {
  try {
    const compressed = await sharp(buffer)
      .webp({ quality: 80 })
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .toBuffer();

    return {
      data: compressed,
      contentType: "image/webp",
      extension: "webp",
    };
  } catch {
    throw new Error("画像のWebP変換に失敗しました。JPEG・PNG・WebP・HEIC形式をご利用ください。");
  }
}

/**
 * 動画を圧縮（MP4形式）
 * @param inputBuffer - 元の動画データ
 * @returns 圧縮後のBufferとContent-Type
 */
export async function compressVideo(
  inputBuffer: Buffer,
): Promise<{ data: Buffer; contentType: string; extension: string }> {
  // 一時ファイルに書き出してFFmpegで処理
  const tempId = randomUUID();
  const inputPath = join(tmpdir(), `input_${tempId}.mp4`);
  const outputPath = join(tmpdir(), `output_${tempId}.mp4`);

  await writeFile(inputPath, inputBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-crf 28",
        "-preset fast",
        "-c:a aac",
        "-b:a 128k",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", async () => {
        try {
          const { readFile } = await import("node:fs/promises");
          const data = await readFile(outputPath);
          // 一時ファイルを削除
          await unlink(inputPath).catch(() => {});
          await unlink(outputPath).catch(() => {});
          resolve({
            data: Buffer.from(data),
            contentType: "video/mp4",
            extension: "mp4",
          });
        } catch (err) {
          reject(err);
        }
      })
      .on("error", async (err) => {
        // 一時ファイルを削除
        await unlink(inputPath).catch(() => {});
        await unlink(outputPath).catch(() => {});
        reject(err);
      })
      .run();
  });
}

/**
 * XSS対策：HTMLタグを無害化
 * 設計書のバリデーションルールに「XSS対策」が明記されているため実装
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
