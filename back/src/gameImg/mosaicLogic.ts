// モザイク適用処理のうち、S3・DB・sharp などのI/Oを伴わない純粋なロジック部分

import { z } from "zod";

export const mosaicSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

export type MosaicRegion = z.infer<typeof mosaicSchema>;

// 指定領域が画像サイズ内に収まっているか判定
export function isWithinImageBounds(
  region: Pick<MosaicRegion, "x" | "y" | "width" | "height">,
  imgWidth: number,
  imgHeight: number,
): boolean {
  return region.x + region.width <= imgWidth && region.y + region.height <= imgHeight;
}

// ピクセル化のための縮小サイズを計算（縮小後は最低1pxを保証）
export function computeMosaicScale(
  width: number,
  height: number,
  pixelSize: number,
): { smallW: number; smallH: number } {
  return {
    smallW: Math.max(1, Math.round(width / pixelSize)),
    smallH: Math.max(1, Math.round(height / pixelSize)),
  };
}
