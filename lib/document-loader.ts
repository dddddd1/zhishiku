import { getTextSplitter } from './langchain';

export interface ParsedDocument {
  pageContent: string;
  metadata: Record<string, unknown>;
}

export async function parsePDF(buffer: Buffer): Promise<string[]> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text.split(/\n\n+/).filter(page => page.trim().length > 0);
  } catch {
    return [];
  }
}

export async function parseText(content: string): Promise<string[]> {
  return content.split(/\n\n+/).filter(page => page.trim().length > 0);
}

export async function parseDocument(
  fileName: string,
  buffer: Buffer
): Promise<ParsedDocument[]> {
  let pages: string[] = [];
  const isMD = fileName.toLowerCase().endsWith('.md');
  const isTXT = fileName.toLowerCase().endsWith('.txt');
  const isPDF = fileName.toLowerCase().endsWith('.pdf');

  if (isPDF) {
    pages = await parsePDF(buffer);
  } else {
    const text = buffer.toString('utf-8');
    pages = await parseText(text);
  }

  const textSplitter = getTextSplitter();
  const documents: ParsedDocument[] = [];

  for (const page of pages) {
    const chunks = await textSplitter.splitText(page);
    for (let i = 0; i < chunks.length; i++) {
      documents.push({
        pageContent: chunks[i],
        metadata: {
          source: fileName,
          chunkIndex: i,
          type: isMD ? 'markdown' : isTXT ? 'text' : 'pdf',
        },
      });
    }
  }

  return documents;
}
