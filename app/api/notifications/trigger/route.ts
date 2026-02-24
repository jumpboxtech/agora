import { NextRequest, NextResponse } from 'next/server';
import { getNotifPreferences, checkNotifDedup, setNotifDedup } from '../../../lib/notification-kv';
import {
  type NotificationCategory,
  NOTIFICATION_CATEGORIES,
  sendFarcasterNotification,
} from '../../../lib/notifications';

// POST /api/notifications/trigger — Client-side notification trigger
// Unlike /send, this is unauthenticated but limited to a single FID per call.
// Protected by preference + dedup checks.

export async function POST(req: NextRequest) {
  let body: {
    fid?: number;
    category?: string;
    title?: string;
    body?: string;
    event_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { fid, category, title, body: bodyText, event_id } = body;

  if (!fid || !category || !title || !bodyText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!NOTIFICATION_CATEGORIES[category as NotificationCategory]) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const eventId = crypto.randomUUID();
  const dedupId = event_id || `${category}-${fid}-${Date.now()}`;

  // Check preference
  const prefs = await getNotifPreferences(fid);
  if (!prefs) {
    return NextResponse.json({ sent: 0, reason: 'not registered' });
  }

  const catKey = category as keyof typeof prefs;
  if (!prefs[catKey]) {
    return NextResponse.json({ sent: 0, reason: 'disabled' });
  }

  // Check dedup
  const isDupe = await checkNotifDedup(category, fid, dedupId);
  if (isDupe) {
    return NextResponse.json({ sent: 0, reason: 'duplicate' });
  }

  // Send via Neynar (uuid must be valid UUID v4)
  const result = await sendFarcasterNotification({
    targetFids: [fid],
    title,
    body: bodyText,
    targetUrl: 'https://agora.jumpbox.tech',
    uuid: eventId,
  });

  if (result.success > 0) {
    await setNotifDedup(category, fid, dedupId);
  }

  return NextResponse.json({ sent: result.success, errors: result.failure });
}
