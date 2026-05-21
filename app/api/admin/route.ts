import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PERSONAS, getAllPersonas, getPersona, type Persona } from '@/lib/personas';
import { clearRoleVectors, getRoleFiles, similaritySearch } from '@/lib/langchain';
import { getRedis } from '@/lib/redis';

const KV_PERSONAS_KEY = 'personas:custom';

async function getCustomPersonas(): Promise<Record<string, Persona>> {
  const redis = getRedis();
  const data = await redis.get<string>(KV_PERSONAS_KEY);
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

  const stats = await Promise.all(
    allPersonas.map(async (p) => {
      const files = await getRoleFiles(p.id);
      let vectorCount = 0;
      try {
        const docs = await similaritySearch(p.id, '__meta__', 1);
        vectorCount = docs.length > 0 ? -1 : 0;
      } catch {
        vectorCount = 0;
      }
      return {
        ...p,
        vectorCount,
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

    const stats = await getAllPersonasWithStats();
    return NextResponse.json({ personas: stats });
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
    const clearVectors = searchParams.get('clearVectors') !== 'false';

    if (!roleId) {
      return NextResponse.json({ error: 'roleId is required' }, { status: 400 });
    }

    if (clearVectors) {
      await clearRoleVectors(roleId);
    }

    return NextResponse.json({ success: true, roleId, vectorsCleared: clearVectors });
  } catch (error) {
    console.error('Admin DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
