import { NextRequest, NextResponse } from 'next/server';
import { parseDocument } from '@/lib/document-loader';
import { addToVectorStore, addRoleFile } from '@/lib/langchain';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const roleId = formData.get('roleId') as string;

    if (!file || !roleId) {
      return NextResponse.json(
        { error: 'File and roleId are required' },
        { status: 400 }
      );
    }

    const validExtensions = ['.pdf', '.md', '.txt', '.xlsx', '.xls', '.docx', '.doc'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use PDF, MD, TXT, XLSX, XLS, DOCX, or DOC' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const blob = await put(file.name, buffer, {
      access: 'private',
    });

    const documents = await parseDocument(file.name, buffer);

    if (documents.length === 0) {
      return NextResponse.json(
        { error: 'Failed to parse document' },
        { status: 500 }
      );
    }

    await addToVectorStore(roleId, documents as any);
    await addRoleFile(roleId, blob.url);

    return NextResponse.json({
      success: true,
      fileUrl: blob.url,
      chunksCount: documents.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
