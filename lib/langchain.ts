import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { formatDocumentsAsString } from 'langchain/util/document';
import { getRedis } from './redis';
import type { Document } from '@langchain/core/documents';

const MODEL_NAME = process.env.MODEL_NAME || 'gpt-4o-mini';
const EMBEDDING_MODEL_NAME = process.env.EMBEDDING_MODEL_NAME || 'text-embedding-3-small';
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '500');
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '50');
const TOP_K = parseInt(process.env.TOP_K || '3');

const VECTOR_DIM = 1536;

let embeddingsInstance: OpenAIEmbeddings | null = null;
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

export function getEmbeddings() {
  if (!embeddingsInstance) {
    embeddingsInstance = new OpenAIEmbeddings({
      modelName: EMBEDDING_MODEL_NAME,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
      },
    });
  }
  return embeddingsInstance;
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
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function createVectorStore(roleId: string, documents: Document[]) {
  const embeddings = getEmbeddings();
  const vectors: StoredVector[] = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const embedding = await embeddings.embedQuery(doc.pageContent);
    vectors.push({
      id: `${roleId}-${i}`,
      embedding,
      content: doc.pageContent,
      metadata: doc.metadata || {},
    });
  }

  const redis = getRedis();
  await redis.set(getVectorKey(roleId), JSON.stringify(vectors));
  return vectors;
}

export async function addToVectorStore(roleId: string, documents: Document[]) {
  const redis = getRedis();
  const existingData = await redis.get<string>(getVectorKey(roleId));
  const existingVectors: StoredVector[] = existingData ? JSON.parse(existingData) : [];
  const embeddings = getEmbeddings();

  const newVectors: StoredVector[] = [];
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const embedding = await embeddings.embedQuery(doc.pageContent);
    newVectors.push({
      id: `${roleId}-${existingVectors.length + i}`,
      embedding,
      content: doc.pageContent,
      metadata: doc.metadata || {},
    });
  }

  const allVectors = [...existingVectors, ...newVectors];
  await redis.set(getVectorKey(roleId), JSON.stringify(allVectors));
  return allVectors;
}

export async function similaritySearch(
  roleId: string,
  query: string,
  k: number = TOP_K
): Promise<Document[]> {
  try {
    const redis = getRedis();
    const data = await redis.get<string>(getVectorKey(roleId));
    if (!data) return [];

    const vectors: StoredVector[] = JSON.parse(data);
    if (vectors.length === 0) return [];

    const embeddings = getEmbeddings();
    const queryEmbedding = await embeddings.embedQuery(query);

    const scored = vectors.map((v) => ({
      vector: v,
      score: cosineSimilarity(queryEmbedding, v.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    const topK = scored.slice(0, k);
    return topK.map((s) => ({
      pageContent: s.vector.content,
      metadata: s.vector.metadata,
    })) as Document[];
  } catch {
    return [];
  }
}

export async function saveChatHistory(
  chatId: string,
  messages: Array<{ type: 'human' | 'ai'; content: string }>
) {
  const redis = getRedis();
  await redis.set(getMemoryKey(chatId), JSON.stringify(messages));
}

export async function loadChatHistory(
  chatId: string
): Promise<Array<{ type: 'human' | 'ai'; content: string }>> {
  const redis = getRedis();
  const data = await redis.get<string>(getMemoryKey(chatId));
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function buildRAGPrompt(systemPrompt: string) {
  return ChatPromptTemplate.fromMessages([
    ['system', systemPrompt + '\n\n当用户提供相关信息时，基于以下知识库内容回答：\n\n{context}'],
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
  const llm = getChatModel();
  const docs = await similaritySearch(roleId, input, TOP_K);
  const context = formatDocumentsAsString(docs);

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
  const sources = docs.map((doc) => ({
    content: doc.pageContent,
    source: doc.metadata?.source as string || 'unknown',
    metadata: doc.metadata,
  }));

  const stream = await llm.stream(messages);

  for await (const chunk of stream) {
    fullResponse += chunk.content;
    yield { response: fullResponse, sources };
  }
}

export async function clearRoleVectors(roleId: string) {
  const redis = getRedis();
  await redis.del(getVectorKey(roleId));
  await redis.del(`files:${roleId}`);
}

export async function getRoleFiles(roleId: string): Promise<string[]> {
  const redis = getRedis();
  return (await redis.get<string[]>(`files:${roleId}`)) || [];
}

export async function addRoleFile(roleId: string, fileUrl: string) {
  const redis = getRedis();
  const files = await getRoleFiles(roleId);
  const newFiles = files.includes(fileUrl) ? files : [...files, fileUrl];
  await redis.set(`files:${roleId}`, newFiles);
  return newFiles;
}
