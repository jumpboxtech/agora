import { NextResponse } from 'next/server';
import { getRedis, leaderboardKey } from '../../../../lib/redis';

export async function GET() {
  const redis = getRedis();
  if (!redis) return NextResponse.json([]);

  try {
    const cached = await redis.get<string>(leaderboardKey());
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      const list = (parsed.burners || []).map((e: { address: string; amount: string }) => ({
        address: e.address,
        score: e.amount,
      }));
      return NextResponse.json(list, {
        headers: { 'Cache-Control': 'public, s-maxage=300', 'Access-Control-Allow-Origin': '*' },
      });
    }
  } catch { /* cache miss */ }

  return NextResponse.json([]);
}
