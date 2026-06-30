// 汎用メディア処理ヘルパー
// 画像・動画・ファイルのアップロード・差し替え・削除を各APIで再利用できるようにする

import { eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "../db/index.js";
import {
  uploadToS3,
  deleteFromS3,
  getPresignedDownloadUrl,
} from "../db/s3.js";
import {
  isValidImageExtension,
  isRawImageExtension,
  isValidVideoExtension,
  validateFileSize,
  validateRawFileSize,
  compressImage,
  compressVideo,
  extractRawPreview,
} from "./media.js";

// メディア処理の結果型
// 成功時はS3パス、失敗時はエラーメッセージとステータスコードを返す
type MediaResult =
  | { success: true; path: string }
  | { success: false; error: string; status: 400 };

/**
 * 画像をバリデーション→圧縮→S3にアップロード
 * @param file - アップロードされた画像ファイル
 * @param s3Prefix - S3の保存先プレフィックス（例: "achievement/abc123"）
 * @returns 成功時はS3パス、失敗時はエラー情報
 */
export async function processImageUpload(
  file: File,
  s3Prefix: string,
): Promise<MediaResult> {
  // 拡張子チェック
  if (!isValidImageExtension(file.name)) {
    return {
      success: false,
      error: "許可されていない画像形式です。",
      status: 400,
    };
  }

  const isRaw = isRawImageExtension(file.name);

  // サイズチェック（RAW形式は50MBまで、通常画像は10MBまで）
  if (isRaw ? !validateRawFileSize(file.size) : !validateFileSize(file.size)) {
    return {
      success: false,
      error: isRaw
        ? "RAW画像のファイルサイズは50MB以下にしてください。"
        : "画像サイズは10MB以下にしてください。",
      status: 400,
    };
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());

  // RAW形式は埋め込みJPEGプレビューを抽出してからWebPに変換
  if (isRaw) {
    try {
      buffer = await extractRawPreview(buffer);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "RAWファイルの処理に失敗しました。",
        status: 400,
      };
    }
  }

  let compressed: Awaited<ReturnType<typeof compressImage>>;
  try {
    compressed = await compressImage(buffer);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "画像の変換に失敗しました。",
      status: 400,
    };
  }
  const s3Key = `${s3Prefix}/${Date.now()}.${compressed.extension}`;
  await uploadToS3(compressed.data, s3Key, compressed.contentType);

  return { success: true, path: s3Key };
}

/**
 * 動画をバリデーション→圧縮→S3にアップロード
 * @param file - アップロードされた動画ファイル
 * @param s3Prefix - S3の保存先プレフィックス（例: "achievement/abc123"）
 * @returns 成功時はS3パス、失敗時はエラー情報
 */
export async function processVideoUpload(
  file: File,
  s3Prefix: string,
): Promise<MediaResult> {
  // 拡張子チェック
  if (!isValidVideoExtension(file.name)) {
    return {
      success: false,
      error: "許可されていない動画形式です。mp4, movのみ対応しています。",
      status: 400,
    };
  }
  // サイズチェック
  if (!validateFileSize(file.size)) {
    return {
      success: false,
      error: "動画サイズは10MB以下にしてください。",
      status: 400,
    };
  }

  // 動画を圧縮してS3にアップロード
  const buffer = Buffer.from(await file.arrayBuffer());
  const compressed = await compressVideo(buffer);
  const s3Key = `${s3Prefix}/${Date.now()}.${compressed.extension}`;
  await uploadToS3(compressed.data, s3Key, compressed.contentType);

  return { success: true, path: s3Key };
}

/**
 * ファイルをバリデーション→S3にアップロード（圧縮なし）
 * @param file - アップロードされたファイル
 * @param s3Prefix - S3の保存先プレフィックス（例: "achievement/abc123/files"）
 * @returns 成功時はS3パス、失敗時はエラー情報
 */
export async function processFileUpload(
  file: File,
  s3Prefix: string,
): Promise<MediaResult> {
  // サイズチェック
  if (!validateFileSize(file.size)) {
    return {
      success: false,
      error: "ファイルサイズは10MB以下にしてください。",
      status: 400,
    };
  }

  // そのままS3にアップロード
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const s3Key = `${s3Prefix}/${Date.now()}_${file.name}`;
  await uploadToS3(
    fileBuffer,
    s3Key,
    file.type || "application/octet-stream",
  );

  return { success: true, path: s3Key };
}

/**
 * 既存メディアをS3から削除して新しいメディアに差し替え
 * @param oldPath - 古いファイルのS3パス（nullの場合は削除をスキップ）
 * @param file - 新しいファイル
 * @param s3Prefix - S3の保存先プレフィックス
 * @param type - メディアの種類（"image" | "video" | "file"）
 * @returns 成功時はS3パス、失敗時はエラー情報
 */
export async function replaceMediaOnS3(
  oldPath: string | null,
  file: File,
  s3Prefix: string,
  type: "image" | "video" | "file",
): Promise<MediaResult> {
  // 古いファイルをS3から削除
  if (oldPath) await deleteFromS3(oldPath);

  // 種類に応じた処理を実行
  switch (type) {
    case "image":
      return processImageUpload(file, s3Prefix);
    case "video":
      return processVideoUpload(file, s3Prefix);
    case "file":
      return processFileUpload(file, `${s3Prefix}/files`);
  }
}

/**
 * 関連するメディアレコードをS3から一括削除
 * @param records - S3パスを持つレコードの配列
 */
export async function deleteMediaFromS3(
  records: { path: string }[],
): Promise<void> {
  for (const record of records) {
    await deleteFromS3(record.path);
  }
}

/**
 * メイン画像/動画/ファイルのS3パスを署名付きURLに変換（未設定ならnull）
 * @param path - S3パス（nullの場合はそのままnullを返す）
 */
export async function toMediaUrl(path: string | null): Promise<string | null> {
  return path ? getPresignedDownloadUrl(path) : null;
}

/**
 * 紐づく関連メディア（images/movies/files）を取得し、署名付きURLに変換
 * @param table - images/movies/filesテーブル
 * @param fkColumn - 紐づけ先の外部キーカラム（例: images.achievement_id）
 * @param id - 紐づけ先のID
 */
export async function getRelatedMediaUrls(
  table: PgTable,
  fkColumn: AnyPgColumn,
  id: string,
): Promise<{ id: string; url: string }[]> {
  const records = (await db
    .select()
    .from(table)
    .where(eq(fkColumn, id))) as { id: string; path: string }[];

  return Promise.all(
    records.map(async (record) => ({
      id: record.id,
      url: await getPresignedDownloadUrl(record.path),
    })),
  );
}
