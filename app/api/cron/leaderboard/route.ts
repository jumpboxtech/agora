import { NextResponse } from 'next/server';
import { getRedis, leaderboardKey } from '../../../lib/redis';
import { getTopStakers, getTopBurners } from '../../../lib/leaderboard';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
  }

  try {
    const [stakers, burners] = await Promise.all([
      getTopStakers(20),
      getTopBurners(20),
    ]);

    const result = { stakers, burners, updatedAt: Date.now() };
    await redis.set(leaderboardKey(), JSON.stringify(result), { ex: 7200 }); // 2h TTL

    return NextResponse.json({
      ok: true,
      stakers: stakers.length,
      burners: burners.length,
    });
  } catch (error) {
    console.error('[cron/leaderboard]', error);
    return NextResponse.json({ error: 'Failed to populate leaderboard' }, { status: 500 });
  }
}
