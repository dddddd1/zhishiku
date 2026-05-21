import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PERSONAS, getAllPersonas, getPersona, type Persona } from '@/lib/personas';
import { clearRoleVectors, getRoleFiles, removeRoleFile } from '@/lib/langchain';
import { del } from '@vercel/blob';
import { getRedis } from '@/lib/redis';

const KV_PERSONAS_KEY = 'personas:custom';

async function getCustomPersonas(): Promise<Record<string, Persona>> {
  const redis = getRedis();
  const data = await (redis as any).get(KV_PERSONAS_KEY);
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveCustomPersona(persona: Persona) {
  const redis = getRedis();
  const custom = await getCustomPersonas();
  custom[persona.id] = persona;
  await redis.set(KV_PERSONAS_KEY, JSON.stringify(custom));
}

async function getAllPersonasWithStats() {
  const defaults = await getAllPersonas();
  const custom = await getCustomPersonas();

  const allPersonas: Persona[] = [
    ...defaults,
    ...Object.values(custom).filter(p => !DEFAULT_PERSONAS[p.id]),
  ];

  // 优化: 并行获取文件列表,但不执行耗时的向量搜索
  const stats = await Promise.all(
    allPersonas.map(async (p) => {
      const files = await getRoleFiles(p.id);
      return {
        ...p,
        vectorCount: null, // 不在列表中显示向量数量,避免性能问题
        filesCount: files.length,
        files,
        isCustom: !!custom[p.id],
      };
    })
  );

  return stats;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');

    if (roleId) {
      const custom = await getCustomPersonas();
      const persona = custom[roleId] || DEFAULT_PERSONAS[roleId] || null;

      if (!persona) {
        return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
      }

      const files = await getRoleFiles(roleId);
      return NextResponse.json({
        ...persona,
        files,
        isCustom: !!custom[roleId],
      });
    }

    // 简化: 只返回基本信息,不查询文件列表
    const defaults = await getAllPersonas();
    const custom = await getCustomPersonas();
    const allPersonas: Persona[] = [
      ...defaults,
      ...Object.values(custom).filter(p => !DEFAULT_PERSONAS[p.id]),
    ];

    const personas = allPersonas.map(p => ({
      ...p,
      filesCount: 0, // 不实时查询
      files: [], // 不返回文件列表
      isCustom: !!custom[p.id],
    }));

    return NextResponse.json({ personas });
  } catch (error) {
    console.error('Admin GET error:', error);
    return NextResponse.json({ error: 'Failed to get data' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, systemPrompt, tone } = body;

    if (!id || !systemPrompt) {
      return NextResponse.json(
        { error: 'id and systemPrompt are required' },
        { status: 400 }
      );
    }

    const existingCustom = await getCustomPersonas();
    const isNewCustom = !DEFAULT_PERSONAS[id] && !existingCustom[id];

    const persona: Persona = {
      id,
      name: name || id,
      description: description || '',
      systemPrompt,
      tone: tone || '专业',
    };

    await saveCustomPersona(persona);

    return NextResponse.json({
      success: true,
      persona,
      isNew: isNewCustom,
    });
  } catch (error) {
    console.error('Admin PUT error:', error);
    return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');
    const fileUrl = searchParams.get('fileUrl');

    if (!roleId) {
      return NextResponse.json({ error: 'roleId is required' }, { status: 400 });
    }

    if (fileUrl) {
      await del(fileUrl);
      await removeRoleFile(roleId, fileUrl);
      return NextResponse.json({ success: true, roleId, fileUrl, deleted: 'file' });
    }

    const clearVectors = searchParams.get('clearVectors') !== 'false';

    if (clearVectors) {
      await clearRoleVectors(roleId);
    }

    return NextResponse.json({ success: true, roleId, vectorsCleared: clearVectors });
  } catch (error) {
    console.error('Admin DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
