// GET /api/trial-application — 体験申し込み一覧を取得（管理者のみ）

import { desc } from "../index.js";
import { count } from "drizzle-orm";
import { db, trialApplication, parsePage, buildPagination } from "../shared/index.js";
import type { Context } from "hono";

export const getAll = async (c: Context) => {
  const { page, limit, offset } = parsePage(c);

  const [applications, totalResult] = await Promise.all([
    db
      .select()
      .from(trialApplication)
      .orderBy(desc(trialApplication.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(trialApplication),
  ]);
  const total = Number(totalResult[0]?.total ?? 0);

  return c.json(
    {
      success: true,
      data: applications,
      pagination: buildPagination(page, limit, total),
    },
    200,
  );
};
