// notification-kv.ts — Redis helpers for notification state

import { getRedis } from './redis';
import { type NotificationPreferences, DEFAULT_PREFERENCES } from './notifications';

// ─── Keys ────────────────────────────────────────────────────────────────────

const prefsKey = (fid: number) => `agora:notif:prefs:${fid}`;
const REGISTERED_SET = 'agora:notif:registered';
const dedupKey = (cat: string, fid: number, eventId: string) =>
  `agora:notif:sent:${cat}:${fid}:${eventId}`;

// ─── Registration ────────────────────────────────────────────────────────────

export async function registerForNotifications(fid: number): Promise<NotificationPreferences> {
  const redis = getRedis();
  if (!redis) return DEFAULT_PREFERENCES;

  const existing = await redis.hgetall(prefsKey(fid));
  if (existing && Object.keys(existing).length > 0) {
    // Already registered — return current prefs
    return parsePreferences(existing as Record<string, unknown>);
  }

  // New registration
  const initial: Record<string, string> = {
    system: '1',
    progress: '1',
    rewards: '1',
    reminder: '1',
    agents: '0',
    registered_at: String(Date.now()),
  };
  await redis.hset(prefsKey(fid), initial);
  await redis.sadd(REGISTERED_SET, fid);

  return DEFAULT_PREFERENCES;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export async function getNotifPreferences(fid: number): Promise<NotificationPreferences | null> {
  const redis = getRedis();
  if (!redis) return null;

  const data = await redis.hgetall(prefsKey(fid));
  if (!data || Object.keys(data).length === 0) return null;

  return parsePreferences(data as Record<string, unknown>);
}

export async function setNotifPreferences(
  fid: number,
  prefs: Partial<NotificationPreferences>,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const mapped: Record<string, string> = {};
  for (const [key, val] of Object.entries(prefs)) {
    if (key === 'system') continue; // system can't be disabled
    mapped[key] = val ? '1' : '0';
  }
  if (Object.keys(mapped).length > 0) {
    await redis.hset(prefsKey(fid), mapped);
  }
}

function parsePreferences(data: Record<string, unknown>): NotificationPreferences {
  const isOn = (v: unknown) => String(v) === '1';
  return {
    system: true, // always on
    progress: isOn(data.progress),
    rewards: isOn(data.rewards),
    reminder: isOn(data.reminder),
    agents: isOn(data.agents),
  };
}

// ─── Dedup ───────────────────────────────────────────────────────────────────

export async function checkNotifDedup(
  category: string,
  fid: number,
  eventId: string,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const exists = await redis.get(dedupKey(category, fid, eventId));
  return !!exists;
}

export async function setNotifDedup(
  category: string,
  fid: number,
  eventId: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  await redis.set(dedupKey(category, fid, eventId), '1', { ex: 86400 }); // 24h TTL
}

// ─── Bulk ────────────────────────────────────────────────────────────────────

export async function getRegisteredFids(): Promise<number[]> {
  const redis = getRedis();
  if (!redis) return [];

  const members = await redis.smembers(REGISTERED_SET);
  return (members || []).map(Number);
}
