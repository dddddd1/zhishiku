import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

/**
 * 获取 Redis 单例实例
 * 使用 @upstash/redis 替代已废弃的 @vercel/kv
 */
export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = Redis.fromEnv(); // 自动读取 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN
  }
  return redisInstance;
}
