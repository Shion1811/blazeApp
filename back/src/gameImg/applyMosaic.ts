// POST /api/gameImg/images/:imageId/mosaic — 指定領域にモザイクを適用（管理者のみ）
// 管理者が x, y, width, height (ピクセル座標) を送信すると、その領域をピクセル化して S3 上書き

import sharp from "sharp";
import { eq } from "../index.js";
import { z } from "zod";
import {
  db,
  images,
  downloadFromS3,
  uploadToS3,
  getPresignedDownloadUrl,
} from "../shared/index.js";
import type { Context } from "hono";

const mosaicSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

export const applyMosaic = async (c: Context) => {
  const imageId = c.req.param("imageId");
  if (!imageId) return c.json({ success: false, errors: "IDが指定されていません。" }, 400);

  const existing = await db.select().from(images).where(eq(images.id, imageId));
  if (existing.length === 0) {
    return c.json({ success: false, errors: "画像が見つかりません。" }, 404);
  }

  if (!existing[0]!.game_id) {
    return c.json(
      { success: false, errors: "試合風景の画像のみモザイクを適用できます。" },
      400,
    );
  }

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const parsed = mosaicSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        errors: "x, y, width, height を0以上の整数で指定してください。",
      },
      400,
    );
  }

  const { x, y, width, height } = parsed.data;
  const s3Key = existing[0]!.path;

  try {
    // S3から元画像をダウンロード
    const originalBuffer = await downloadFromS3(s3Key);

    // 画像サイズを取得して座標が範囲内か確認
    const metadata = await sharp(originalBuffer).metadata();
    const imgWidth = metadata.width ?? 0;
    const imgHeight = metadata.height ?? 0;

    if (x + width > imgWidth || y + height > imgHeight) {
      return c.json(
        {
          success: false,
          errors: `指定領域が画像サイズ（${imgWidth}×${imgHeight}px）を超えています。`,
        },
        400,
      );
    }

    // 指定領域をピクセル化（スケールダウン → ニアレストネイバーでスケールアップ）
    const PIXEL_SIZE = 15;
    const smallW = Math.max(1, Math.round(width / PIXEL_SIZE));
    const smallH = Math.max(1, Math.round(height / PIXEL_SIZE));

    const mosaicRegion = await sharp(originalBuffer)
      .extract({ left: x, top: y, width, height })
      .resize(smallW, smallH, { fit: "fill" })
      .resize(width, height, { fit: "fill", kernel: "nearest" })
      .toBuffer();

    // モザイク領域を元画像に合成して WebP で書き出し
    const result = await sharp(originalBuffer)
      .composite([{ input: mosaicRegion, left: x, top: y }])
      .webp({ quality: 80 })
      .toBuffer();

    // S3 に上書きアップロード（元画像を完全に置き換え）
    await uploadToS3(result, s3Key, "image/webp");
  } catch (e) {
    console.error("[applyMosaic] 画像処理に失敗:", e);
    return c.json(
      { success: false, errors: "画像の処理中にエラーが発生しました。" },
      500,
    );
  }

  const updatedUrl = await getPresignedDownloadUrl(s3Key);

  return c.json(
    {
      success: true,
      message: "モザイクを適用しました。",
      data: { id: imageId, url: updatedUrl },
    },
    200,
  );
};
