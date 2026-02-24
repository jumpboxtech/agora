import { NextResponse } from 'next/server';
import { getRedis, directoryKey } from '../../../lib/redis';
import { getRegisteredAgents } from '../../../lib/agora-data';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
  }

  try {
    const agents = await getRegisteredAgents(0, 100);

    const result = { agents, updatedAt: Date.now() };
    await redis.set(directoryKey(), JSON.stringify(result), { ex: 7200 }); // 2h TTL

    return NextResponse.json({ ok: true, agents: agents.length });
  } catch (error) {
    console.error('[cron/directory]', error);
    return NextResponse.json({ error: 'Failed to populate directory' }, { status: 500 });
  }
}
