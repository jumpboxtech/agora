import { NextResponse } from 'next/server';
import { getRedis, leaderboardKey } from '../../../lib/redis';

// Minimal JSON for external consumption (EmpireBuilder airdrop lists)
// Returns { stakers: [{wallet, amount}], burners: [{wallet, amount}] }
export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ stakers: [], burners: [] });
  }

  try {
    const cached = await redis.get<string>(leaderboardKey());
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      const slim = (list: { address: string; amount: string }[]) =>
        (list || []).map((e) => ({ wallet: e.address, amount: e.amount }));

      return NextResponse.json(
        { stakers: slim(parsed.stakers), burners: slim(parsed.burners) },
        { headers: { 'Cache-Control': 'public, s-maxage=300', 'Access-Control-Allow-Origin': '*' } },
      );
    }
  } catch { /* cache miss */ }

  return NextResponse.json({ stakers: [], burners: [] });
}
