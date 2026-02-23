import { NextRequest, NextResponse } from 'next/server';
import { getRedis, stateKey } from '../../../lib/redis';
import { getRegisteredFids, getNotifPreferences, checkNotifDedup, setNotifDedup } from '../../../lib/notification-kv';
import { sendFarcasterNotification } from '../../../lib/notifications';

// GET /api/cron/daily-reminder — Send daily check-in reminders
// Runs via Vercel Cron at 18:00 UTC (or manual trigger)

export async function GET(req: NextRequest) {
  // Auth: Vercel cron sends CRON_SECRET, or use query param for manual trigger
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
  }

  const fids = await getRegisteredFids();
  if (fids.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const eventId = `daily-reminder-${today}`;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const eligibleFids: number[] = [];
  let skipped = 0;

  for (const fid of fids) {
    // Check notification preference
    const prefs = await getNotifPreferences(fid);
    if (!prefs?.reminder) { skipped++; continue; }

    // Check dedup
    const isDupe = await checkNotifDedup('reminder', fid, eventId);
    if (isDupe) { skipped++; continue; }

    // Check if daily check-in is unclaimed (from game state in Redis)
    const stateRaw = await redis.get(stateKey(fid));
    if (stateRaw) {
      const state = typeof stateRaw === 'string' ? JSON.parse(stateRaw) : stateRaw;
      const lastCheckin = (state as Record<string, unknown>).agoraDailyCheckin as number;
      if (lastCheckin && now - lastCheckin < TWENTY_FOUR_HOURS) {
        // Already checked in today — skip
        skipped++;
        continue;
      }
    }

    eligibleFids.push(fid);
  }

  if (eligibleFids.length === 0) {
    return NextResponse.json({ sent: 0, skipped });
  }

  // Send in batches of 100 (Neynar limit)
  let totalSent = 0;
  let totalErrors = 0;

  for (let i = 0; i < eligibleFids.length; i += 100) {
    const batch = eligibleFids.slice(i, i + 100);
    const result = await sendFarcasterNotification({
      targetFids: batch,
      title: 'Daily Check-in Ready',
      body: 'Your $AGORA check-in reward is waiting! Open Agora to claim.',
      uuid: `${eventId}-${i}`,
    });
    totalSent += result.success;
    totalErrors += result.failure;
  }

  // Set dedup for all sent FIDs
  for (const fid of eligibleFids) {
    await setNotifDedup('reminder', fid, eventId);
  }

  return NextResponse.json({ sent: totalSent, skipped, errors: totalErrors });
}
