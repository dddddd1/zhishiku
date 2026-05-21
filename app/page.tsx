'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ content: string; source: string; chunkIndex: number }>;
}

interface Persona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tone: string;
}

export default function Home() {
  const [selectedRole, setSelectedRole] = useState('sales-assistant');
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/admin')
      .then(res => res.json())
      .then(data => {
        setPersonas(data.personas || []);
      })
      .catch(() => {
        setPersonas([]);
      });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const url = new URL('/api/chat', window.location.origin);
      url.searchParams.set('roleId', selectedRole);
      if (chatId) {
        url.searchParams.set('chatId', chatId);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) throw new Error('Request failed');

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let sources: any[] = [];
      let currentChatId = chatId;

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '' },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content') {
                assistantMessage = data.content;
                setMessages((prev) => [
                  ...prev.slice(0, -1),
                  { role: 'assistant', content: assistantMessage, sources },
                ]);
              } else if (data.type === 'sources') {
                sources = data.sources;
              } else if (data.type === 'done') {
                currentChatId = data.chatId;
                if (!chatId) {
                  setChatId(currentChatId);
                }
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '抱歉，发生了错误，请稍后重试。' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function resetChat() {
    setChatId(null);
    setMessages([]);
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">多人设 RAG 导购系统</h1>
        <div className="flex items-center gap-4">
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              resetChat();
            }}
            className="border rounded px-3 py-1"
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={resetChat}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            新对话
          </button>
          <a
            href="/admin"
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            管理后台
          </a>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg">你好！我是 {personas.find(p => p.id === selectedRole)?.name}</p>
              <p className="text-sm mt-2">请开始你的对话</p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-current/20">
                    <p className="text-xs opacity-75 mb-2">参考来源:</p>
                    {msg.sources.map((src, j) => (
                      <div key={j} className="text-xs opacity-75 mb-1">
                        <span className="font-semibold">{src.source}</span>
                        <p className="line-clamp-2">{src.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-4">
                正在思考...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSend} className="border-t p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            disabled={isLoading}
            className="flex-1 border rounded px-4 py-2 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}
