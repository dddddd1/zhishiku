import 'server-only';
import type { Redis as UpstashRedis } from '@upstash/redis';
import type Redis from 'ioredis';

let redisInstance: UpstashRedis | Redis | null = null;
let initError: Error | null = null;

/**
 * 初始化 Redis 连接
 * 在服务器端使用 ioredis (支持 Redis 协议)
 * 在客户端或 Edge Runtime 中使用 @upstash/redis (需要 REST API)
 */
function initializeRedis(): UpstashRedis | Redis {
  // 优先使用标准的 Upstash REST API 配置 (@upstash/redis)
  console.log('[Redis] Initializing Redis...', process.env.UPSTASH_REDIS_REST_URL);
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log('[Redis] Using UPSTASH_REDIS_REST_URL with @upstash/redis');
    const { Redis } = require('@upstash/redis');
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } 
  
  // fallback: 使用 REDIS_URL (仅服务器端,使用 ioredis)
  if (process.env.REDIS_URL && typeof window === 'undefined') {
    try {
      console.log(`[Redis] Using REDIS_URL with ioredis`);
      const IoRedis = require('ioredis');
      
      const redis = new IoRedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
      
      // 添加连接事件监听
      redis.on('connect', () => {
        console.log('[Redis] Connected successfully');
      });
      
      redis.on('error', (err: Error) => {
        console.error('[Redis] Connection error:', err.message);
        console.error('[Redis] Error details:', err);
      });
      
      redis.on('ready', () => {
        console.log('[Redis] Ready to accept commands');
      });
      
      return redis;
    } catch (error) {
      console.error('[Redis] Failed to initialize ioredis:', error);
      throw error;
    }
  } 
  
  throw new Error(
    'Redis configuration not found. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN,\n' +
    'or REDIS_URL (server-side only).'
  );
}

/**
 * 获取 Redis 单例实例
 */
export function getRedis(): UpstashRedis | Redis {
  if (!redisInstance) {
    try {
      redisInstance = initializeRedis();
    } catch (error) {
      initError = error as Error;
      throw error;
    }
  }
  
  if (initError) {
    throw initError;
  }
  
  return redisInstance;
}
