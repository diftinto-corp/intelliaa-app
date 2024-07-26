"use server";

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getData(key: string) {
  const data = await redis.lrange(key, 0, 100);

  return data;
}

export async function delData(key: string) {
  await redis.del(key);
}
