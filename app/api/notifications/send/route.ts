import { NextRequest, NextResponse } from 'next/server';
import { getNotifPreferences, checkNotifDedup, setNotifDedup } from '../../../lib/notification-kv';
import {
  type NotificationCategory,
  NOTIFICATION_CATEGORIES,
  sendFarcasterNotification,
} from '../../../lib/notifications';

// POST /api/notifications/send — Send notification to target FIDs
// Protected by NOTIFICATION_SECRET

export async function POST(req: NextRequest) {
  // Auth check — internal calls only
  const secret = process.env.NOTIFICATION_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: {
    category?: string;
    target_fids?: number[];
    title?: string;
    body?: string;
    target_url?: string;
    event_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { category, target_fids, title, body: bodyText, target_url, event_id } = body;

  if (!category || !NOTIFICATION_CATEGORIES[category as NotificationCategory]) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  if (!target_fids || !Array.isArray(target_fids) || target_fids.length === 0) {
    return NextResponse.json({ error: 'No target FIDs' }, { status: 400 });
  }
  if (!title || !bodyText) {
    return NextResponse.json({ error: 'Missing title or body' }, { status: 400 });
  }

  const eventId = event_id || `${category}-${Date.now()}`;

  // Filter FIDs by preference + dedup
  const eligibleFids: number[] = [];
  let skipped = 0;

  for (const fid of target_fids) {
    const prefs = await getNotifPreferences(fid);
    if (!prefs) { skipped++; continue; }

    const catKey = category as keyof typeof prefs;
    if (!prefs[catKey]) { skipped++; continue; }

    const isDupe = await checkNotifDedup(category, fid, eventId);
    if (isDupe) { skipped++; continue; }

    eligibleFids.push(fid);
  }

  if (eligibleFids.length === 0) {
    return NextResponse.json({ sent: 0, skipped, errors: 0 });
  }

  // Send via Neynar
  const result = await sendFarcasterNotification({
    targetFids: eligibleFids,
    title,
    body: bodyText,
    targetUrl: target_url,
    uuid: eventId,
  });

  // Set dedup keys for successful sends
  for (const fid of eligibleFids) {
    await setNotifDedup(category, fid, eventId);
  }

  return NextResponse.json({
    sent: result.success,
    skipped,
    errors: result.failure,
  });
}
