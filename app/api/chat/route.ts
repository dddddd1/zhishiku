import { NextRequest } from 'next/server';
import { getPersona } from '@/lib/personas';
import { streamRAGChain, loadChatHistory, saveChatHistory } from '@/lib/langchain';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId') || 'sales-assistant';
    const chatId = searchParams.get('chatId') || generateId();

    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Message is required' })}\n\n`),
        {
          status: 400,
          headers: { 'Content-Type': 'text/event-stream', 'Connection': 'close' },
        }
      );
    }

    const persona = await getPersona(roleId);
    const chatHistory = await loadChatHistory(chatId);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let lastSources: Array<{ content: string; source: string; metadata?: Record<string, unknown> }> = [];
          let lastResponse = '';

          for await (const result of streamRAGChain(
            roleId,
            persona.systemPrompt,
            message,
            chatHistory
          )) {
            // 只发送内容
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'content', content: result.response })}\n\n`)
            );
            lastResponse = result.response;
            lastSources = result.sources;
          }

          const updatedHistory = [
            ...chatHistory,
            { type: 'human' as const, content: message },
          ];

          await saveChatHistory(chatId, updatedHistory);

          // 等回答结束后才发送参考来源
          if (lastSources.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources: lastSources })}\n\n`)
            );
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', chatId })}\n\n`)
          );

          controller.close();
        } catch (error) {
          console.error('[Chat] Stream error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Stream error',
                stack: error instanceof Error ? error.stack : undefined,
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return new Response(
      encoder.encode(
        `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Internal error',
        })}\n\n`
      ),
      {
        status: 500,
        headers: { 'Content-Type': 'text/event-stream', 'Connection': 'close' },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new Response(JSON.stringify({ error: 'chatId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const history = await loadChatHistory(chatId);

  return Response.json({ chatId, history });
}
