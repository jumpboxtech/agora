import { NextRequest, NextResponse } from 'next/server';
import { getRedis, directoryKey } from '../../../lib/redis';
import type { AgentDirectoryEntry } from '../../../lib/agora-data';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search')?.toLowerCase() || '';
  const tierFilter = request.nextUrl.searchParams.get('tier');
  const hasTokenFilter = request.nextUrl.searchParams.get('hasToken');
  const sort = request.nextUrl.searchParams.get('sort') || 'tasks';

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ agents: [], total: 0, updatedAt: 0 });
  }

  try {
    const cached = await redis.get<string>(directoryKey());
    if (!cached) {
      return NextResponse.json({ agents: [], total: 0, updatedAt: 0 });
    }

    const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
    let agents: AgentDirectoryEntry[] = parsed.agents || [];

    // Filter
    if (search) {
      agents = agents.filter(
        (a) => a.name.toLowerCase().includes(search) || a.address.toLowerCase().includes(search),
      );
    }
    if (tierFilter) {
      const tier = parseInt(tierFilter, 10);
      if (!isNaN(tier)) agents = agents.filter((a) => a.tier === tier);
    }
    if (hasTokenFilter === 'true') {
      agents = agents.filter((a) => a.hasToken);
    }

    // Sort
    switch (sort) {
      case 'revenue':
        agents.sort((a, b) => parseFloat(b.totalEarned) - parseFloat(a.totalEarned));
        break;
      case 'endpoints':
        agents.sort((a, b) => b.endpointCount - a.endpointCount);
        break;
      case 'name':
        agents.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'tasks':
      default:
        agents.sort((a, b) => b.totalTasks - a.totalTasks);
        break;
    }

    return NextResponse.json({
      agents,
      total: agents.length,
      updatedAt: parsed.updatedAt || 0,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    });
  } catch (error) {
    console.error('[agents/directory]', error);
    return NextResponse.json({ agents: [], total: 0, updatedAt: 0 });
  }
}
