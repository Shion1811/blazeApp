// 一覧取得API共通のページネーションヘルパー（1ページ10件固定）

import type { Context } from "hono";

const PAGE_SIZE = 10;

export function parsePage(c: Context) {
  const rawPage = Number(c.req.query("page"));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const offset = (page - 1) * PAGE_SIZE;
  return { page, limit: PAGE_SIZE, offset };
}

export function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
