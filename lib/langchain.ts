import 'server-only';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { formatDocumentsAsString } from 'langchain/util/document';
import { getRedis } from './redis';
import type { Document } from '@langchain/core/documents';

const MODEL_NAME = process.env.MODEL_NAME || 'gpt-4o-mini';
const EMBEDDING_MODEL_NAME = process.env.EMBEDDING_MODEL_NAME || 'text-embedding-3-small';
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '800'); // 减小到800字符，让每块更精准
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '100'); // 减少重叠
const TOP_K = parseInt(process.env.TOP_K || '5'); // 增加到5，获取更多候选
const SIMILARITY_THRESHOLD = 0.35; // 进一步降低阈值，让更多相关内容被召回

const VECTOR_DIM = 1536;

let chatModelInstance: ChatOpenAI | null = null;

export function getChatModel() {
  if (!chatModelInstance) {
    chatModelInstance = new ChatOpenAI({
      modelName: MODEL_NAME,
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
      },
    });
  }
  return chatModelInstance;
}

// 自定义智谱Embedding调用
async function getZhipuEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
  const model = EMBEDDING_MODEL_NAME;
  console.log(`[ZhipuEmbedding] Using model: ${model}`, baseURL, apiKey);
  try {
    console.log(`[ZhipuEmbedding] Calling API for text length: ${text.length}`);
    
    const response = await fetch(`${baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        input: text.substring(0, 8192), // 智谱有长度限制
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ZhipuEmbedding] API error: ${response.status} - ${errorText}`);
      throw new Error(`Embedding API failed: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    
    if (!embedding) {
      console.error(`[ZhipuEmbedding] Invalid response:`, data);
      throw new Error('No embedding in response');
    }

    console.log(`[ZhipuEmbedding] Success, embedding length: ${embedding.length}`);
    console.log(`[ZhipuEmbedding] Sample:`, embedding.slice(0, 5));
    
    return embedding;
  } catch (error) {
    console.error(`[ZhipuEmbedding] Error:`, error);
    // 降级：返回随机向量（只是为了演示，生产环境应该抛出错误）
    console.warn(`[ZhipuEmbedding] Using fallback random embedding`);
    return Array.from({ length: 256 }, () => (Math.random() - 0.5) * 2);
  }
}

export function getEmbeddings() {
  // 返回一个兼容的对象
  return {
    embedQuery: getZhipuEmbedding,
    embedDocuments: async (texts: string[]) => {
      const results: number[][] = [];
      for (const text of texts) {
        results.push(await getZhipuEmbedding(text));
      }
      return results;
    }
  } as any;
}

export function getTextSplitter() {
  return new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
}

function getVectorKey(roleId: string) {
  return `vectors:${roleId}`;
}

function getMemoryKey(chatId: string) {
  return `memory:${chatId}`;
}

interface StoredVector {
  id: string;
  embedding: number[];
  content: string;
  metadata: Record<string, unknown>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) {
    return 0;
  }
  
  // 确保两个向量长度一致
  const minLength = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < minLength; i++) {
    // 检查值是否有效
    if (isNaN(a[i]) || isNaN(b[i])) continue;
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  // 避免除以0
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  const similarity = dot / denominator;
  
  // 确保返回值在合理范围内
  return Math.max(-1, Math.min(1, similarity));
}

// 关键词匹配分数计算
function keywordMatchScore(query: string, content: string): number {
  const queryWords = query.toLowerCase().split(/[\s\p{P}]+/u).filter(w => w.length > 1);
  const contentLower = content.toLowerCase();
  
  if (queryWords.length === 0) return 0;
  
  let matchCount = 0;
  for (const word of queryWords) {
    if (contentLower.includes(word)) {
      matchCount++;
    }
  }
  
  return matchCount / queryWords.length;
}

// 综合评分：向量相似度 + 关键词匹配
function combinedScore(vectorScore: number, keywordScore: number): number {
  return vectorScore * 0.85 + keywordScore * 0.15;
}

export async function createVectorStore(roleId: string, documents: Document[]) {
  const embeddings = getEmbeddings();
  const vectors: StoredVector[] = [];

  console.log(`[VectorStore] Creating vector store for role: ${roleId}, docs: ${documents.length}`);

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    try {
      console.log(`[VectorStore] Embedding doc ${i + 1}/${documents.length}, content length: ${doc.pageContent.length}`);
      const embedding = await embeddings.embedQuery(doc.pageContent);
      console.log(`[VectorStore] Got embedding of length: ${embedding.length}`);
      
      vectors.push({
        id: `${roleId}-${i}`,
        embedding,
        content: doc.pageContent,
        metadata: doc.metadata || {},
      });
    } catch (e) {
      console.error(`[VectorStore] Error embedding doc ${i}:`, e);
    }
  }

  const redis = getRedis();
  await redis.set(getVectorKey(roleId), JSON.stringify(vectors));
  console.log(`[VectorStore] Saved ${vectors.length} vectors for role: ${roleId}`);
  return vectors;
}

export async function addToVectorStore(roleId: string, documents: Document[]) {
  const redis = getRedis() as any;
  const existingData = await redis.get(getVectorKey(roleId)) as string | null;
  const existingVectors: StoredVector[] = existingData ? JSON.parse(existingData) : [];
  const embeddings = getEmbeddings();

  console.log(`[VectorStore] Adding ${documents.length} docs to existing ${existingVectors.length} vectors`);

  const newVectors: StoredVector[] = [];
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    try {
      console.log(`[VectorStore] Embedding new doc ${i + 1}/${documents.length}`);
      const embedding = await embeddings.embedQuery(doc.pageContent);
      console.log(`[VectorStore] New embedding length: ${embedding.length}`);
      
      newVectors.push({
        id: `${roleId}-${existingVectors.length + i}`,
        embedding,
        content: doc.pageContent,
        metadata: doc.metadata || {},
      });
    } catch (e) {
      console.error(`[VectorStore] Error embedding new doc ${i}:`, e);
    }
  }

  const allVectors = [...existingVectors, ...newVectors];
  await redis.set(getVectorKey(roleId), JSON.stringify(allVectors));
  console.log(`[VectorStore] Total vectors now: ${allVectors.length}`);
  return allVectors;
}

// 简单的 embedding 缓存
const embeddingCache = new Map<string, number[]>();

export async function similaritySearch(
  roleId: string,
  query: string,
  k: number = TOP_K
): Promise<Document[]> {
  try {
    console.log(`[Search] Starting search for roleId: ${roleId}`);
    const redis = getRedis() as any;
    
    const redisStart = Date.now();
    const data = await redis.get(getVectorKey(roleId)) as string | null;
    const redisTime = Date.now() - redisStart;
    console.log(`[Search] Redis query completed in ${redisTime}ms`);
    
    if (!data) {
      console.log(`[Search] No data found for roleId: ${roleId}`);
      return [];
    }

    const parseStart = Date.now();
    const vectors: StoredVector[] = JSON.parse(data);
    const parseTime = Date.now() - parseStart;
    console.log(`[Search] JSON parse completed in ${parseTime}ms, found ${vectors.length} vectors`);
    
    // 调试信息：打印第一个向量的信息
    if (vectors.length > 0) {
      console.log(`[Search] First vector:`, {
        id: vectors[0].id,
        embeddingLength: vectors[0].embedding?.length,
        embeddingSample: vectors[0].embedding?.slice(0, 5),
        content: vectors[0].content.substring(0, 100),
      });
    }
    
    if (vectors.length === 0) return [];

    const embeddings = getEmbeddings();
    
    // 检查缓存
    const cacheKey = `${roleId}:${query}`;
    let queryEmbedding: number[];
    
    if (embeddingCache.has(cacheKey)) {
      queryEmbedding = embeddingCache.get(cacheKey)!;
      console.log(`[Search] Using cached embedding for query`);
    } else {
      const embedStart = Date.now();
      console.log(`[Search] Computing embedding for query: "${query.substring(0, 50)}..."`);
      queryEmbedding = await embeddings.embedQuery(query);
      const embedTime = Date.now() - embedStart;
      console.log(`[Search] Embedding computed in ${embedTime}ms, length: ${queryEmbedding.length}`);
      console.log(`[Search] Query embedding sample:`, queryEmbedding.slice(0, 5));
      
      // 缓存 (限制缓存大小)
      if (embeddingCache.size > 100) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey) {
          embeddingCache.delete(firstKey);
        }
      }
      embeddingCache.set(cacheKey, queryEmbedding);
    }

    const simStart = Date.now();
    
    // 计算综合评分（向量相似度 + 关键词匹配）
    const scored = vectors.map((v) => {
      const vectorScore = cosineSimilarity(queryEmbedding, v.embedding);
      const keywordScore = keywordMatchScore(query, v.content);
      const finalScore = combinedScore(vectorScore, keywordScore);
      return {
        vector: v,
        score: finalScore,
        vectorScore,
        keywordScore,
      };
    });

    // 1. 按综合评分排序
    scored.sort((a, b) => b.score - a.score);
    
    // 打印前10个结果的评分详情，方便调试
    console.log(`[Search] Top 10 scores:`, scored.slice(0, 10).map(s => ({ 
      finalScore: s.score.toFixed(3), 
      vectorScore: s.vectorScore.toFixed(3), 
      keywordScore: s.keywordScore.toFixed(3),
      source: s.vector.metadata?.source, 
      content: s.vector.content.substring(0, 50) + '...' 
    })));
    
    // 2. 过滤掉相似度太低的结果
    const filtered = scored.filter(s => s.score >= SIMILARITY_THRESHOLD);
    console.log(`[Search] Filtered to ${filtered.length} results above threshold ${SIMILARITY_THRESHOLD}`);
    
    // 3. 先按文件分组，每个文件只保留得分最高的块
    const fileBestMap = new Map<string, typeof filtered[0]>();
    for (const item of filtered) {
      const source = item.vector.metadata?.source as string || 'unknown';
      if (!fileBestMap.has(source) || item.score > fileBestMap.get(source)!.score) {
        fileBestMap.set(source, item);
      }
    }
    
    // 4. 去重后按文件得分排序
    const deduplicated = Array.from(fileBestMap.values());
    deduplicated.sort((a, b) => b.score - a.score);
    
    console.log(`[Search] Deduplicated to ${deduplicated.length} files:`, deduplicated.map(s => s.vector.metadata?.source));
    
    // 5. 取前k个
    const topK = deduplicated.slice(0, k);
    const simTime = Date.now() - simStart;
    console.log(`[Search] Calculation completed in ${simTime}ms (${vectors.length} vectors)`);
    console.log(`[Search] Final selected sources:`, topK.map(s => s.vector.metadata?.source));
    
    return topK.map((s) => ({
      pageContent: s.vector.content,
      metadata: s.vector.metadata,
    })) as Document[];
  } catch (error) {
    console.error('[Search] Error occurred:', error);
    if (error instanceof Error) {
      console.error('[Search] Error stack:', error.stack);
    }
    return [];
  }
}

export async function saveChatHistory(
  chatId: string,
  messages: Array<{ type: 'human' | 'ai'; content: string }>
) {
  const redis = getRedis() as any;
  await redis.set(getMemoryKey(chatId), JSON.stringify(messages));
}

export async function loadChatHistory(
  chatId: string
): Promise<Array<{ type: 'human' | 'ai'; content: string }>> {
  const redis = getRedis() as any;
  const data = await redis.get(getMemoryKey(chatId)) as string | null;
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function buildRAGPrompt(systemPrompt: string) {
  return ChatPromptTemplate.fromMessages([
    ['system', systemPrompt + `

====================
【知识库内容 - 必须严格遵循】
{context}
====================

【重要指令】
1. 你必须严格按照上述知识库内容回答用户问题
2. 如果知识库中有相关内容，必须引用知识库的具体内容来回答
3. 绝对不要编造知识库中没有的信息
4. 如果知识库内容与问题无关，请明确告知用户"当前知识库没有相关内容"
5. 引用知识库内容时，可以引用具体段落或数据
6. 回答要专业、准确、自然流畅

【回答格式】
建议按以下格式回答：
- 先引用知识库中的相关内容和数据
- 然后给出专业建议或结论
- 最后注明参考来源`],
    new MessagesPlaceholder('history'),
    ['human', '{input}'],
  ]);
}

export interface RAGResult {
  response: string;
  sources: Array<{
    content: string;
    source: string;
    metadata?: Record<string, unknown>;
  }>;
}

export async function* streamRAGChain(
  roleId: string,
  systemPrompt: string,
  input: string,
  chatHistory: Array<{ type: 'human' | 'ai'; content: string }>
): AsyncGenerator<RAGResult, void, unknown> {
  const startTime = Date.now();
  console.log(`[Chat] Starting RAG chain for roleId: ${roleId}`);
  
  const llm = getChatModel();
  
  // 测量向量搜索耗时
  const searchStart = Date.now();
  const docs = await similaritySearch(roleId, input, TOP_K);
  const searchTime = Date.now() - searchStart;
  console.log(`[Chat] Vector search completed in ${searchTime}ms, found ${docs.length} documents`);
  
  // 调试：打印找到的文档内容
  console.log(`[Chat] Found ${docs.length} relevant documents:`);
  docs.forEach((doc, i) => {
    console.log(`  [${i}] ${doc.metadata?.source}:`);
    console.log(`    ${doc.pageContent.substring(0, 200)}...`);
  });
  
  // 手动格式化context，确保内容正确传递
  let context = '';
  if (docs.length > 0) {
    docs.forEach((doc, i) => {
      const source = doc.metadata?.source || 'unknown';
      context += `【来源 ${i + 1}: ${source}】\n${doc.pageContent}\n\n`;
    });
  } else {
    context = '（暂无可参考的知识库内容）';
  }
  
  console.log(`[Chat] Formatted context (length: ${context.length}):`);
  console.log(`--- START CONTEXT ---`);
  console.log(context);
  console.log(`--- END CONTEXT ---`);

  const prompt = buildRAGPrompt(systemPrompt);

  const messages = await prompt.formatMessages({
    input,
    context,
    history: chatHistory.map((m) => ({
      type: m.type === 'human' ? 'human' : 'ai',
      content: m.content,
    })),
  });

  let fullResponse = '';
  
  // 按文件去重，每个文件只保留得分最高的内容
  // 同时确保内容不重复（比较前100字符）
  const sourceSeen = new Set<string>();
  const sources: Array<{ content: string; source: string; metadata?: Record<string, unknown> }> = [];
  
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const source = doc.metadata?.source as string || 'unknown';
    const contentPreview = doc.pageContent.substring(0, 100);
    const key = `${source}_${contentPreview}`;
    
    if (!sourceSeen.has(key)) {
      sourceSeen.add(key);
      sources.push({
        content: doc.pageContent,
        source: source,
        metadata: doc.metadata,
      });
    }
  }

  console.log(`[Chat] Found ${docs.length} docs, generating ${sources.length} unique sources`);

  console.log(`[Chat] Starting LLM streaming...`);
  const llmStart = Date.now();
  const stream = await llm.stream(messages);

  for await (const chunk of stream) {
    fullResponse += chunk.content;
    // 只在第一次yield时打印sources调试信息
    if (fullResponse === chunk.content) {
      console.log(`[Chat] First yield - sources:`, sources.length, sources.map(s => s.source));
    }
    yield { response: fullResponse, sources };
  }
  
  const totalTime = Date.now() - startTime;
  const llmTime = Date.now() - llmStart;
  console.log(`[Chat] Completed - Total: ${totalTime}ms, Search: ${searchTime}ms, LLM: ${llmTime}ms`);
}

export async function clearRoleVectors(roleId: string) {
  const redis = getRedis() as any;
  
  // 先获取文件列表
  const files = await getRoleFiles(roleId);
  
  // 删除 Blob 中的文件（如果有 del 函数）
  if (files.length > 0) {
    try {
      // 动态导入 del，避免在边缘运行时出错
      const { del } = await import('@vercel/blob');
      for (const fileUrl of files) {
        try {
          await del(fileUrl);
          console.log(`[Clear] Deleted file from Blob: ${fileUrl}`);
        } catch (e) {
          console.error(`[Clear] Failed to delete ${fileUrl}:`, e);
        }
      }
    } catch (e) {
      console.error('[Clear] Failed to import del function:', e);
    }
  }
  
  // 删除向量和文件列表
  await redis.del(getVectorKey(roleId));
  await redis.del(`files:${roleId}`);
  console.log(`[Clear] Cleared all data for role: ${roleId}`);
}

export async function getRoleFiles(roleId: string): Promise<string[]> {
  const redis = getRedis() as any;
  const data = await redis.get(`files:${roleId}`);
  if (!data) return [];
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addRoleFile(roleId: string, fileUrl: string) {
  const redis = getRedis() as any;
  const files = await getRoleFiles(roleId);
  if (files.includes(fileUrl)) return files;
  const newFiles = [...files, fileUrl];
  await redis.set(`files:${roleId}`, JSON.stringify(newFiles));
  return newFiles;
}

export async function removeRoleFile(roleId: string, fileUrl: string) {
  const redis = getRedis() as any;
  const files = await getRoleFiles(roleId);
  const newFiles = files.filter(f => f !== fileUrl);
  await redis.set(`files:${roleId}`, JSON.stringify(newFiles));
  
  // 同时删除向量库中属于这个文件的向量
  const vectorKey = getVectorKey(roleId);
  const data = await redis.get(vectorKey);
  if (data) {
    const vectors: StoredVector[] = JSON.parse(data);
    const filteredVectors = vectors.filter(v => {
      const source = v.metadata?.source as string || '';
      return source !== fileUrl;
    });
    await redis.set(vectorKey, JSON.stringify(filteredVectors));
    console.log(`[Remove] Removed ${vectors.length - filteredVectors.length} vectors for file: ${fileUrl}`);
  }
  
  return newFiles;
}
