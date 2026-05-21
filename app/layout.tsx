import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '多人设 RAG 导购系统',
  description: '基于 LangChain.js + Vercel 的智能对话系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
