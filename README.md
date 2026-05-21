# 多人设 RAG 导购系统

基于 Next.js 14+、LangChain.js 和 Vercel KV/Blob 构建的智能对话系统，支持多人设管理和 RAG 知识库。

## 技术栈

- **Next.js 14** (App Router, Edge Runtime)
- **LangChain.js** (不用 LangGraph)
- **Vercel KV** (Upstash，向量存储 + 会话记忆)
- **Vercel Blob** (文件存储)
- **OpenAI API** (兼容 DeepSeek、通义千问等)

## 核心功能

### 1. 多人设管理
- 预置 4 种人设：智能导购、培训讲师、客服、技术顾问
- 每个人设独立的 system prompt、语气、回答规则
- 知识库按 roleId 完全隔离
- 支持动态切换，API 可指定 roleId
- **支持创建自定义人设**（通过管理后台）

### 2. RAG 知识库
- 支持上传 PDF/MD/TXT 文件
- 文件存储在 Vercel Blob
- 向量存储在 Vercel KV (Upstash)，按 roleId 隔离
- 相似度检索 (Top-K)，返回引用片段
- 支持增量添加文件到已有知识库

### 3. 对话 API
- **POST** `/api/chat?roleId=xxx&chatId=xxx`
- 流式输出 (SSE)
- 会话记忆自动保存到 KV
- 多轮对话连贯
- 返回引用来源

### 4. 管理后台
- `/admin` - 人设列表、状态查看
- 上传文件到指定人设
- 编辑/新建人设（自定义 system prompt）
- 清空指定人设的向量库

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`:

```env
# LLM 配置
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1

# 兼容 DeepSeek
# OPENAI_BASE_URL=https://api.deepseek.com/v1

# Vercel KV (Upstash)
KV_URL=https://xxx.upstash.io
KV_REST_API_TOKEN=xxx
KV_REST_API_READ_ONLY_TOKEN=xxx

# Vercel Blob
BLOB_READ_WRITE_TOKEN=xxx
```

### 3. 本地开发

```bash
npm run dev
```

访问 http://localhost:3000

## 部署到 Vercel

### 1. 创建 Vercel 项目

```bash
vercel
```

### 2. 添加存储

在 Vercel Dashboard → Storage 创建:
- **KV** (Upstash) - 用于向量存储和会话记忆
- **Blob** - 用于文件存储

### 3. 设置环境变量

在 Vercel 项目设置中添加所有 `.env` 中的环境变量。

### 4. 部署

```bash
vercel --prod
```

## API 文档

### 聊天 API

```javascript
POST /api/chat?roleId=sales-assistant&chatId=xxx
Content-Type: application/json

{
  "message": "你好，我想了解产品"
}
```

响应: SSE 流

```javascript
// 事件类型:
// - content: 回复文本增量
// - sources: 参考来源数组
// - done: 完成，包含 chatId
// - error: 错误信息

async function chat(message, roleId = 'sales-assistant') {
  const response = await fetch(`/api/chat?roleId=${roleId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n\n').filter(Boolean);

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const event = JSON.parse(line.slice(6));
        console.log(event.type, event);
      }
    }
  }
}
```

### 上传文件 API

```javascript
POST /api/upload
Content-Type: multipart/form-data

file: File
roleId: string
```

### 管理 API

```javascript
// 获取所有人设状态
GET /api/admin

// 获取指定人设详情
GET /api/admin?roleId=sales-assistant

// 编辑/新建人设
PUT /api/admin
Content-Type: application/json
{
  "id": "my-persona",
  "name": "我的助手",
  "description": "描述",
  "systemPrompt": "你是...",
  "tone": "友好"
}

// 清空知识库
DELETE /api/admin?roleId=sales-assistant&clearVectors=true
```

### 获取历史记录

```javascript
GET /api/chat?chatId=xxx
```

## 人设列表

| ID | 名称 | 描述 |
|----|------|------|
| sales-assistant | 智能导购 | 专业的产品推荐和销售顾问 |
| trainer | 培训讲师 | 专业的培训和知识讲解专家 |
| customer-service | 客服 | 专业的客户服务和问题解决专家 |
| tech-advisor | 技术顾问 | 专业的技术咨询和解决方案专家 |

## 项目结构

```
.
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # 聊天 API (Edge Runtime)
│   │   ├── upload/route.ts      # 上传 API (Node.js Runtime)
│   │   └── admin/route.ts       # 管理 API
│   ├── admin/page.tsx          # 管理后台
│   └── page.tsx                # 首页
├── lib/
│   ├── personas.ts             # 人设配置 (支持 KV 动态加载)
│   ├── langchain.ts            # LangChain 核心封装
│   └── document-loader.ts      # 文档解析
├── .env.example
└── package.json
```

## 架构说明

### Edge Runtime vs Node.js Runtime

- **聊天 API** (`/api/chat`): 使用 Edge Runtime，低延迟，适合实时对话
- **上传 API** (`/api/upload`): 使用 Node.js Runtime，处理文件上传

### 向量存储

使用 **Upstash Vector** (通过 Vercel KV):
- 支持向量相似度搜索
- 按 roleId 隔离不同人设的知识库
- 持久化存储，重启不丢失

### 会话记忆

- 每个 chatId 独立的会话历史
- 存储在 Vercel KV
- 自动加载和保存

## 注意事项

1. **Edge 超时**: Vercel Edge Function 有 10 秒超时限制，确保 LLM 响应足够快
2. **向量库大小**: Upstash KV 有免费额度限制，大规模部署需考虑付费计划
3. **文件大小**: Vercel Blob 单文件限制 4.5MB
4. **Token 控制**: `CHUNK_SIZE=500` 和 `CHUNK_OVERLAP=50` 可根据文档调整

## 许可证

MIT
