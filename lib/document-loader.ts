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

export async function parseExcel(buffer: Buffer): Promise<string[]> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const pages: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const sheetText = XLSX.utils.sheet_to_csv(sheet);
      if (sheetText.trim()) {
        pages.push(`[表格: ${sheetName}]\n${sheetText}`);
      }
    }
    return pages;
  } catch {
    return [];
  }
}

export async function parseWord(buffer: Buffer): Promise<string[]> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value.split(/\n\n+/).filter(page => page.trim().length > 0);
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
  const lowerName = fileName.toLowerCase();

  const isMD = lowerName.endsWith('.md');
  const isTXT = lowerName.endsWith('.txt');
  const isPDF = lowerName.endsWith('.pdf');
  const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
  const isWord = lowerName.endsWith('.docx') || lowerName.endsWith('.doc');

  if (isPDF) {
    pages = await parsePDF(buffer);
  } else if (isExcel) {
    pages = await parseExcel(buffer);
  } else if (isWord) {
    pages = await parseWord(buffer);
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
          type: isMD ? 'markdown' : isTXT ? 'text' : isPDF ? 'pdf' : isExcel ? 'excel' : 'word',
        },
      });
    }
  }

  return documents;
}
