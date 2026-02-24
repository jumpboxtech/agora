import { NextResponse } from 'next/server';
import { getRedis, leaderboardKey } from '../../lib/redis';

// Cache-only — populated by /api/cron/leaderboard every hour
export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ stakers: [], burners: [], updatedAt: 0 });
  }

  try {
    const cached = await redis.get<string>(leaderboardKey());
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return NextResponse.json(parsed, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    }
  } catch { /* cache miss */ }

  return NextResponse.json({ stakers: [], burners: [], updatedAt: 0 });
}
