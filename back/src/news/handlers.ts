// newsテーブル（type='news' | 'media'）に対する汎用CRUDハンドラ生成
// news APIとmedia APIは同じnewsテーブルをtypeで分けて使うため、ロジックを共通化する

import { createGetAll } from "./getAll.js";
import { createGetById } from "./getById.js";
import { createCreate } from "./create.js";
import { createUpdate } from "./update.js";
import { createRemove } from "./delete.js";

type NewsType = "news" | "media";

export function createNewsTypeHandlers(
  type: NewsType,
  label: string,
  s3Prefix: string,
) {
  return {
    getAll: createGetAll(type),
    getById: createGetById(type, label),
    create: createCreate(type, label, s3Prefix),
    update: createUpdate(type, label, s3Prefix),
    remove: createRemove(type, label),
  };
}
