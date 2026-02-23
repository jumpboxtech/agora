import { NextRequest, NextResponse } from 'next/server';
import { registerForNotifications } from '../../../lib/notification-kv';

// POST /api/notifications/register — Register FID for notifications

export async function POST(req: NextRequest) {
  let body: { fid?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { fid } = body;
  if (!fid || typeof fid !== 'number') {
    return NextResponse.json({ error: 'Missing or invalid fid' }, { status: 400 });
  }

  const preferences = await registerForNotifications(fid);
  return NextResponse.json({ ok: true, preferences });
}
