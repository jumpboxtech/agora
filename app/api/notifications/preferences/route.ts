import { NextRequest, NextResponse } from 'next/server';
import { getNotifPreferences, setNotifPreferences } from '../../../lib/notification-kv';

// GET /api/notifications/preferences?fid=123

export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get('fid');
  if (!fid || isNaN(Number(fid))) {
    return NextResponse.json({ error: 'Missing or invalid fid' }, { status: 400 });
  }

  const prefs = await getNotifPreferences(Number(fid));
  if (!prefs) {
    return NextResponse.json({ error: 'Not registered' }, { status: 404 });
  }

  return NextResponse.json({ preferences: prefs });
}

// POST /api/notifications/preferences — Update notification preferences

export async function POST(req: NextRequest) {
  let body: { fid?: number; preferences?: Record<string, boolean> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { fid, preferences } = body;
  if (!fid || !preferences) {
    return NextResponse.json({ error: 'Missing fid or preferences' }, { status: 400 });
  }

  await setNotifPreferences(fid, preferences);
  const updated = await getNotifPreferences(fid);

  return NextResponse.json({ ok: true, preferences: updated });
}
