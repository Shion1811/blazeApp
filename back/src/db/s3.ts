// S3ストレージユーティリティ

import {
  S3Client,
  // S3のアップロードコマンド
  PutObjectCommand,
  // S3の削除コマンド
  DeleteObjectCommand,
  // S3の取得コマンド
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
// 署名付きURL生成
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3クライアントにリクエストを送るための準備
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

/**
 * S3にファイルをアップロード
 * @param buffer - ファイルのバイナリデータ
 * @param key - S3上の保存先パス（例: "news/abc123/image.webp"）
 * @param contentType - MIMEタイプ（例: "image/webp"）
 */
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

/**
 * S3からファイルを削除
 * @param key - S3上のパス
 */
export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
}

/**
 * S3からファイルをダウンロードしてBufferで返す
 * @param key - S3上のパス
 */
export async function downloadFromS3(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );
  const stream = response.Body as Readable;
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * 署名付きURL（一時的にアクセスできるURL）を生成
 * @param key - S3上のパス
 * @param expiresIn - 有効期限（秒）デフォルト1時間
 * @returns 署名付きURL
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * S3の保存先パスを生成
 * @param entityType - コンテンツの種類（例: "news", "achievement"）
 * @param entityId - コンテンツのID
 * @param filename - 元のファイル名
 * @returns S3キー（例: "news/abc123/1234567890_image.webp"）
 */
export function generateS3Key(
  entityType: string,
  entityId: string,
  filename: string,
): string {
  // タイムスタンプを付けて一意にする
  const timestamp = Date.now();
  // ファイル名から拡張子を取得
  const ext = filename.split(".").pop()?.toLowerCase() || "bin";
  return `${entityType}/${entityId}/${timestamp}.${ext}`;
}
