import { NextResponse } from 'next/server';
import { getRedis, leaderboardKey } from '../../lib/redis';
import { getTopStakers, getTopBurners, type LeaderboardEntry } from '../../lib/leaderboard';

const CACHE_TTL = 300; // 5 minutes

interface CachedLeaderboard {
  stakers: LeaderboardEntry[];
  burners: LeaderboardEntry[];
  updatedAt: number;
}

export async function GET() {
  const redis = getRedis();

  // Try cache first
  if (redis) {
    try {
      const cached = await redis.get<string>(leaderboardKey());
      if (cached) {
        const parsed: CachedLeaderboard = typeof cached === 'string' ? JSON.parse(cached) : cached;
        if (Date.now() - parsed.updatedAt < CACHE_TTL * 1000) {
          return NextResponse.json(parsed, {
            headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
          });
        }
      }
    } catch { /* cache miss */ }
  }

  // Fetch fresh data
  try {
    const [stakers, burners] = await Promise.all([
      getTopStakers(20),
      getTopBurners(20),
    ]);

    const result: CachedLeaderboard = { stakers, burners, updatedAt: Date.now() };

    if (redis) {
      await redis.set(leaderboardKey(), JSON.stringify(result), { ex: CACHE_TTL });
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ stakers: [], burners: [], updatedAt: 0 }, { status: 500 });
  }
}
