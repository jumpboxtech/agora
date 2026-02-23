import { NextRequest, NextResponse } from 'next/server';
import { getRedis, stateKey } from '../../lib/redis';

// ─── GET /api/state?fid=123 — Load game state from Redis ────────────────────

export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get('fid');
  if (!fid || isNaN(Number(fid))) {
    return NextResponse.json({ error: 'Missing or invalid fid' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  const data = await redis.get(stateKey(Number(fid)));
  if (!data) {
    return NextResponse.json({ state: null });
  }

  return NextResponse.json({ state: data });
}

// ─── POST /api/state — Save game state to Redis ─────────────────────────────
// Body: { fid: number, state: GameState }

export async function POST(req: NextRequest) {
  let body: { fid?: number; state?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { fid, state } = body;
  if (!fid || !state) {
    return NextResponse.json({ error: 'Missing fid or state' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  // Strip transient fields before persisting
  const cleaned = { ...state };
  delete cleaned.recentCalls;
  delete cleaned.feedEvents;
  delete cleaned.offlineSummary;
  cleaned.lastTick = Date.now();

  // Store with 30-day TTL (auto-expire inactive saves)
  await redis.set(stateKey(fid), JSON.stringify(cleaned), { ex: 30 * 24 * 60 * 60 });

  return NextResponse.json({ ok: true });
}
