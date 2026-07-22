// モザイク適用の純粋ロジック（バリデーション・境界チェック・縮小サイズ計算）の単体テスト
// DB・S3・sharpのI/Oを伴わないため、DB接続なしで実行できる
import { describe, it, expect } from "vitest";
import { mosaicSchema, isWithinImageBounds, computeMosaicScale } from "../gameImg/mosaicLogic.js";

describe("mosaicSchema", () => {
  it("x, y, width, height が全て0以上の整数なら成功する", () => {
    const result = mosaicSchema.safeParse({ x: 0, y: 0, width: 100, height: 100 });
    expect(result.success).toBe(true);
  });

  it("width/height が0以下だと失敗する（矩形として成立しないため）", () => {
    expect(mosaicSchema.safeParse({ x: 0, y: 0, width: 0, height: 10 }).success).toBe(false);
    expect(mosaicSchema.safeParse({ x: 0, y: 0, width: 10, height: 0 }).success).toBe(false);
  });

  it("x/y が負数だと失敗する", () => {
    expect(mosaicSchema.safeParse({ x: -1, y: 0, width: 10, height: 10 }).success).toBe(false);
    expect(mosaicSchema.safeParse({ x: 0, y: -1, width: 10, height: 10 }).success).toBe(false);
  });

  it("小数だと失敗する", () => {
    expect(mosaicSchema.safeParse({ x: 0, y: 0, width: 10.5, height: 10 }).success).toBe(false);
  });

  it("フィールドが欠けていると失敗する", () => {
    expect(mosaicSchema.safeParse({ x: 0, y: 0, width: 10 }).success).toBe(false);
  });
});

describe("isWithinImageBounds", () => {
  it("領域が画像内に完全に収まっていれば true", () => {
    expect(isWithinImageBounds({ x: 10, y: 10, width: 50, height: 50 }, 100, 100)).toBe(true);
  });

  it("領域が画像の端にちょうど接する場合は true（境界値）", () => {
    expect(isWithinImageBounds({ x: 0, y: 0, width: 100, height: 100 }, 100, 100)).toBe(true);
  });

  it("幅が画像サイズをはみ出す場合は false", () => {
    expect(isWithinImageBounds({ x: 60, y: 0, width: 50, height: 10 }, 100, 100)).toBe(false);
  });

  it("高さが画像サイズをはみ出す場合は false", () => {
    expect(isWithinImageBounds({ x: 0, y: 60, width: 10, height: 50 }, 100, 100)).toBe(false);
  });
});

describe("computeMosaicScale", () => {
  it("width/heightをpixelSizeで割った値に丸める", () => {
    expect(computeMosaicScale(150, 300, 15)).toEqual({ smallW: 10, smallH: 20 });
  });

  it("縮小結果が0になる場合は最低1pxを保証する", () => {
    expect(computeMosaicScale(5, 5, 15)).toEqual({ smallW: 1, smallH: 1 });
  });

  it("四捨五入される", () => {
    // 22/15 = 1.46... → 1, 23/15 = 1.53... → 2
    expect(computeMosaicScale(22, 23, 15)).toEqual({ smallW: 1, smallH: 2 });
  });
});
