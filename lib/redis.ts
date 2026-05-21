import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

/**
 * 获取 Redis 单例实例
 * 支持两种配置方式:
 * 1. UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (推荐)
 * 2. REDIS_URL (Vercel Upstash 集成自动配置)
 */
export function getRedis(): Redis {
  if (!redisInstance) {
    // 优先使用标准的 Upstash 环境变量
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redisInstance = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } 
    //  fallback 到 Vercel 集成的 REDIS_URL
    else if (process.env.REDIS_URL) {
      // 从 REDIS_URL 解析出 host 和 password
      // 格式: redis://default:password@host:port
      const url = new URL(process.env.REDIS_URL);
      const host = url.hostname;
      const password = url.password;
      
      // Upstash REST API URL 通常是 https://{host}
      const restUrl = `https://${host}`;
      
      redisInstance = new Redis({
        url: restUrl,
        token: password,
      });
    } 
    else {
      throw new Error(
        'Redis configuration not found. Please set either:\n' +
        '- UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or\n' +
        '- REDIS_URL (from Vercel Upstash integration)'
      );
    }
  }
  return redisInstance;
}
