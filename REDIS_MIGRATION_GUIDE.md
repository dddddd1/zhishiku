# Vercel Redis (Upstash) 配置与迁移指南

## 📋 当前状态

你的项目正在使用 **已废弃的 `@vercel/kv`**,需要迁移到 **`@upstash/redis`**。

> ⚠️ **重要提示**: `@vercel/kv` 已被 Vercel 官方标记为 deprecated,不再推荐使用。

---

## 🚀 方案一:通过 Vercel Marketplace 一键配置(推荐) ⭐

这是最简单的方式,Vercel 会自动配置所有环境变量。

### 步骤 1: 安装 Upstash Redis

在项目根目录运行:

```bash
vercel integration add upstash
```

或者在 Vercel Dashboard 中:
1. 进入你的项目
2. 点击 **Storage** → **Browse Marketplace**
3. 搜索 **Upstash Redis**
4. 点击 **Add Integration**
5. 选择免费套餐或付费套餐

### 步骤 2: 自动配置的环境变量

Vercel 会自动添加以下环境变量到你的项目:
- `UPSTASH_REDIS_REST_URL` - Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis 访问令牌

### 步骤 3: 更新依赖包

```bash
# 移除旧的 @vercel/kv
npm uninstall @vercel/kv

# 安装新的 @upstash/redis
npm install @upstash/redis
```

### 步骤 4: 更新代码

需要将所有使用 `@vercel/kv` 的地方替换为 `@upstash/redis`。

#### 示例: lib/langchain.ts

**之前:**
```typescript
import { kv } from '@vercel/kv';

// 使用方式
await kv.set('key', 'value');
const value = await kv.get('key');
```

**之后:**
```typescript
import { Redis } from '@upstash/redis';

// 创建 Redis 实例(单例模式)
let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = Redis.fromEnv(); // 自动读取 UPSTASH_REDIS_* 环境变量
  }
  return redisInstance;
}

// 使用方式
const redis = getRedis();
await redis.set('key', 'value');
const value = await redis.get('key');
```

#### 主要 API 对照表

| @vercel/kv | @upstash/redis | 说明 |
|------------|----------------|------|
| `kv.set(key, value)` | `redis.set(key, value)` | 设置值 |
| `kv.get(key)` | `redis.get(key)` | 获取值 |
| `kv.del(key)` | `redis.del(key)` | 删除键 |
| `kv.exists(key)` | `redis.exists(key)` | 检查键是否存在 |
| `kv.incr(key)` | `redis.incr(key)` | 自增 |
| `kv.decr(key)` | `redis.decr(key)` | 自减 |
| `kv.expire(key, seconds)` | `redis.expire(key, seconds)` | 设置过期时间 |

---

## 🔧 方案二:手动配置 Upstash Redis

如果你不想使用 Vercel Marketplace,可以手动配置。

### 步骤 1: 注册 Upstash

1. 访问 [https://upstash.com](https://upstash.com)
2. 注册账号
3. 创建一个新的 Redis 数据库
4. 复制 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`

### 步骤 2: 配置环境变量

将以下变量添加到你的 `.env` 文件:

```env
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### 步骤 3: 同步到 Vercel

```bash
# 将本地 .env 推送到 Vercel
vercel env pull .env.local --yes
```

或者在 Vercel Dashboard 中手动添加环境变量。

---

## 📝 完整的代码迁移示例

### 1. lib/langchain.ts 迁移

```typescript
// 之前
import { kv } from '@vercel/kv';

export async function createVectorStore(roleId: string, documents: Document[]) {
  // ...
  await kv.set(getVectorKey(roleId), JSON.stringify(vectors));
  return vectors;
}

// 之后
import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = Redis.fromEnv();
  }
  return redisInstance;
}

export async function createVectorStore(roleId: string, documents: Document[]) {
  const redis = getRedis();
  // ...
  await redis.set(getVectorKey(roleId), JSON.stringify(vectors));
  return vectors;
}
```

### 2. lib/personas.ts 迁移

```typescript
// 之前
import { kv } from '@vercel/kv';

async function getCustomPersonas(): Promise<Record<string, Persona>> {
  try {
    const data = await kv.get<string>(KV_PERSONAS_KEY);
    if (!data) return {};
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// 之后
import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = Redis.fromEnv();
  }
  return redisInstance;
}

async function getCustomPersonas(): Promise<Record<string, Persona>> {
  const redis = getRedis();
  try {
    const data = await redis.get<string>(KV_PERSONAS_KEY);
    if (!data) return {};
    return JSON.parse(data);
  } catch {
    return {};
  }
}
```

### 3. app/api/admin/route.ts 迁移

同样的方式,将所有 `kv.*` 调用替换为 `redis.*`。

---

## ✅ 验证迁移

### 1. 本地测试

```bash
npm run dev
```

访问应用,测试以下功能:
- 上传文件到知识库
- 聊天对话(验证向量检索)
- 人设管理(验证自定义人设保存)

### 2. 检查 Vercel 日志

部署后,在 Vercel Dashboard 查看日志,确保没有 Redis 连接错误。

---

## 🎯 最佳实践

### 1. 使用单例模式

避免每次请求都创建新的 Redis 实例:

```typescript
let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = Redis.fromEnv();
  }
  return redisInstance;
}
```

### 2. 错误处理

```typescript
try {
  const data = await redis.get('key');
  if (!data) {
    // 处理不存在的情况
    return defaultValue;
  }
  return JSON.parse(data);
} catch (error) {
  console.error('Redis error:', error);
  return defaultValue;
}
```

### 3. 设置过期时间

对于临时数据,设置合理的过期时间:

```typescript
// 会话数据,1小时后过期
await redis.set(`session:${chatId}`, JSON.stringify(messages), {
  ex: 3600 // 秒
});
```

---

## 📊 Upstash 免费套餐限制

- **最大数据库数**: 10
- **存储空间**: 256 MB
- **每日命令数**: 10,000
- **最大连接数**: 20

对于大多数小型项目,免费套餐足够使用。

---

## 🔗 相关资源

- [Upstash 官方文档](https://upstash.com/docs/redis)
- [Vercel Storage 技能包](./.agents/skills/vercel-storage/SKILL.md)
- [@upstash/redis NPM 包](https://www.npmjs.com/package/@upstash/redis)
- [Vercel Marketplace](https://vercel.com/marketplace)

---

## ❓ 常见问题

### Q: 迁移后需要清空现有的数据吗?

A: 不需要。Upstash Redis 和 Vercel KV 使用相同的底层技术(Redis),数据结构兼容。但建议在迁移前备份重要数据。

### Q: 可以同时使用 @vercel/kv 和 @upstash/redis 吗?

A: 技术上可以,但不推荐。建议完全迁移到 @upstash/redis,避免混淆和维护成本。

### Q: 迁移会影响性能吗?

A: 不会。@upstash/redis 是 @vercel/kv 的底层实现,性能相同甚至更好。

### Q: 如果遇到问题怎么办?

A: 
1. 检查环境变量是否正确配置
2. 查看 Vercel 日志中的错误信息
3. 参考 Upstash 官方文档
4. 联系 Vercel 或 Upstash 支持
