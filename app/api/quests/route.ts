import { NextRequest, NextResponse } from 'next/server';
import { getRedis, questKey } from '../../lib/redis';
import { QUESTS } from '../../lib/quests';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';

// Jumpbox FID — used for follow verification
const JUMPBOX_FID = 842363;

// ─── GET: fetch completed quests for a FID ──────────────────────────────────

export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get('fid');
  if (!fid) return NextResponse.json({ error: 'fid required' }, { status: 400 });

  const redis = getRedis();
  if (!redis) {
    // No Redis — return empty (graceful degradation)
    return NextResponse.json({ completed: [] });
  }

  const completed = await redis.smembers(questKey(Number(fid)));
  return NextResponse.json({ completed });
}

// ─── POST: claim a quest ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fid, questId, gameState } = body as {
    fid: number;
    questId: string;
    gameState?: { tier: number; totalProcessed: number; totalEarned: number; totalPlayTime: number; apisDeployed?: number; agentsHired?: number; agoraStaked?: number };
  };

  if (!fid || !questId) {
    return NextResponse.json({ error: 'fid and questId required' }, { status: 400 });
  }

  const quest = QUESTS.find(q => q.id === questId);
  if (!quest) {
    return NextResponse.json({ error: 'unknown quest' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'storage unavailable' }, { status: 503 });
  }

  // Check if already completed
  const alreadyDone = await redis.sismember(questKey(fid), questId);
  if (alreadyDone) {
    return NextResponse.json({ error: 'already completed', reward: 0 });
  }

  // ─── Verify based on quest type ────────────────────────────────────────────

  if (quest.type === 'social' && quest.verify) {
    const verified = await verifySocialQuest(fid, quest.verify);
    if (!verified) {
      return NextResponse.json({ error: 'verification failed', detail: quest.verify }, { status: 403 });
    }
  }

  if (quest.type === 'milestone' && quest.milestone && gameState) {
    const value = gameState[quest.milestone.field] ?? 0;
    if (value < quest.milestone.threshold) {
      return NextResponse.json({ error: 'milestone not reached', required: quest.milestone.threshold, current: value }, { status: 403 });
    }
  }

  // Mark complete
  await redis.sadd(questKey(fid), questId);

  return NextResponse.json({ success: true, reward: quest.reward, questId });
}

// ─── Neynar Verification ─────────────────────────────────────────────────────

async function verifySocialQuest(
  fid: number,
  verify: 'follow_jumpbox' | 'share_cast' | 'add_miniapp' | 'follow_x',
): Promise<boolean> {
  switch (verify) {
    case 'follow_jumpbox':
      return checkFollow(fid, JUMPBOX_FID);

    case 'follow_x':
      // X API v2 pay-per-use: $0.01/call via connection_status field
      // Requires X_ACCESS_TOKEN (OAuth 2.0 for @jumpbox_tech account)
      // Fetches user's X handle from Neynar verified_accounts
      // then checks if they follow @jumpbox_tech
      return checkXFollow(fid);

    case 'share_cast':
      return checkShareCast(fid);

    case 'add_miniapp':
      // Trust-based — SDK call was made
      return true;

    default:
      return false;
  }
}

async function checkFollow(followerFid: number, targetFid: number): Promise<boolean> {
  if (!NEYNAR_API_KEY) return true; // No API key = auto-approve

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${followerFid}&viewer_fid=${targetFid}`,
      { headers: { 'x-api-key': NEYNAR_API_KEY } },
    );

    if (!res.ok) return true; // API error = auto-approve (don't block users)

    const data = await res.json();
    const user = data.users?.[0];
    if (!user) return true;

    // viewer_context.followed_by means the followerFid follows targetFid
    return user.viewer_context?.following === true;
  } catch {
    return true; // Network error = auto-approve
  }
}

// Share cast verification — check if user cast with the Agora URL
const AGORA_URL = 'agora.jumpbox.tech';

async function checkShareCast(fid: number): Promise<boolean> {
  if (!NEYNAR_API_KEY) return true; // No API key = auto-approve

  try {
    // Search user's recent casts for the Agora embed URL
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fid}&limit=5`,
      { headers: { 'x-api-key': NEYNAR_API_KEY } },
    );
    if (!res.ok) return true;

    const data = await res.json();
    const casts = data.casts as { text: string; embeds?: { url?: string }[] }[];
    if (!casts?.length) return false;

    // Check if any recent cast contains the Agora URL in text or embeds
    return casts.some(cast =>
      cast.text?.includes(AGORA_URL) ||
      cast.embeds?.some(e => e.url?.includes(AGORA_URL)),
    );
  } catch {
    return true; // Error = auto-approve
  }
}

// X API v2 follow verification ($0.01/call pay-per-use)
// Set X_ACCESS_TOKEN env var (OAuth 2.0 token for @jumpbox_tech) to enable
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN || '';
const X_TARGET_USERNAME = 'jumpbox_tech';

async function checkXFollow(fid: number): Promise<boolean> {
  if (!X_ACCESS_TOKEN || !NEYNAR_API_KEY) return false; // No token = cannot verify

  try {
    // Step 1: Get user's X handle from Neynar verified_accounts
    const neyRes = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      { headers: { 'x-api-key': NEYNAR_API_KEY } },
    );
    if (!neyRes.ok) return false;

    const neyData = await neyRes.json();
    const user = neyData.users?.[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xAccount = user?.verified_accounts?.find((a: any) => a.platform === 'x');
    if (!xAccount?.username) return false; // No linked X = can't verify follow

    // Step 2: Look up user on X with connection_status
    // Auth as @jumpbox_tech — connection_status shows if looked-up user follows us
    const xRes = await fetch(
      `https://api.x.com/2/users/by/username/${xAccount.username}?user.fields=connection_status`,
      { headers: { Authorization: `Bearer ${X_ACCESS_TOKEN}` } },
    );
    if (!xRes.ok) return false;

    const xData = await xRes.json();
    // connection_status.following means the looked-up user follows the authenticated user
    return xData.data?.connection_status?.following === true;
  } catch {
    return false; // Error = cannot verify
  }
}
