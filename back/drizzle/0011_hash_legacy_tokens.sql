-- 既存のusers.tokenは生値のまま保存されていたため、token.tsのhashToken()と同じ
-- アルゴリズム（SHA-256/hex）でDB側も変換し、既存ログインセッションを維持する。
UPDATE "users" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex') WHERE "token" IS NOT NULL;
