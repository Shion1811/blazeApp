// Redis接続

import { createClient } from "../index.js";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL が .env に設定されていません");
}

const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

export { redisClient };
