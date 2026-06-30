// プロジェクト内部モジュールの集約

// DB接続
export { db } from "../db/index.js";

// Redis接続
export { redisClient } from "../db/redis.js";

// テーブル定義
export {
  admin,
  news,
  inquiry,
  reply,
  achievement,
  game,
  images,
  movies,
  files,
  deletionRequests,
  deletionApprovals,
} from "../db/schema.js";

// バリデーションスキーマ
export {
  emailSchema,
  passwordBaseSchema,
  titleSchema,
  bodySchema,
  inquiryNameSchema,
} from "../db/schema.js";

// 認証ミドルウェア
export { authToken } from "../db/token.js";

// ロールガード
export { requireOwner, requireAdmin } from "../db/roleGuard.js";

// S3ストレージ
export {
  uploadToS3,
  deleteFromS3,
  getPresignedDownloadUrl,
  generateS3Key,
} from "../db/s3.js";

// メディア処理ユーティリティ
export {
  isValidImageExtension,
  isValidVideoExtension,
  validateFileSize,
  validateMultipleFiles,
  validateFileExtension,
  compressImage,
  compressVideo,
  sanitizeHtml,
} from "../utils/media.js";

// 汎用メディア処理ヘルパー
export {
  processImageUpload,
  processVideoUpload,
  processFileUpload,
  replaceMediaOnS3,
  deleteMediaFromS3,
  toMediaUrl,
  getRelatedMediaUrls,
} from "../utils/mediaHandler.js";

// 汎用CRUDルーター
export { createCrudRouter } from "../utils/crudRouter.js";
