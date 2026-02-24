import { NextRequest, NextResponse } from 'next/server';
import { keccak256, encodeAbiParameters, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { QUESTS } from '../../lib/quests';
import { getRedis, questKey, stateKey } from '../../lib/redis';

// ─── Config ──────────────────────────────────────────────────────────────────

const REWARDS_CONTRACT = '0xF7d3b7362021d0dd90E38006e87ac0DC1D537225';
const CHAIN_ID = 8453; // Base mainnet
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';

// Reward amounts in $AGORA (whole tokens, converted to wei)
const REWARD_AMOUNTS: Record<string, bigint> = {
  deploy_api:        parseEther('2000'),
  upgrade_tier:      parseEther('2000'),
  daily_checkin:     parseEther('1000'),
  tutorial_complete: parseEther('2000'),
};

// Limits (must match contract values)
const MAX_CLAIM_AMOUNT = parseEther('10000');
const DAILY_CAP = parseEther('20000');
const LIFETIME_CAP = parseEther('500000');
const COOLDOWN_SECONDS = 30; // 30s (matches on-chain contract)
const MAX_CLAIMS_PER_DAY = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Verify that `address` is a verified address for `fid` via Neynar */
async function verifyFidOwnsAddress(fid: number, address: string): Promise<boolean> {
  if (!NEYNAR_API_KEY) return false; // No API key = reject (strict mode)

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      { headers: { 'x-api-key': NEYNAR_API_KEY } },
    );
    if (!res.ok) return false;

    const data = await res.json();
    const user = data.users?.[0];
    if (!user) return false;

    const lowerAddress = address.toLowerCase();

    // Check custody address
    if (user.custody_address?.toLowerCase() === lowerAddress) return true;

    // Check verified addresses
    if (user.verified_addresses?.eth_addresses) {
      return user.verified_addresses.eth_addresses.some(
        (a: string) => a.toLowerCase() === lowerAddress,
      );
    }

    return false;
  } catch {
    return false;
  }
}

/** Verify that the action was actually completed in game state */
async function verifyAction(
  redis: ReturnType<typeof getRedis>,
  fid: number,
  action: string,
  questId?: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (!redis) return { valid: false, reason: 'storage unavailable' };

  if (action === 'complete_quest') {
    if (!questId) return { valid: false, reason: 'missing questId' };
    // Check quest was actually completed via the quests system
    const completed = await redis.sismember(questKey(fid), questId);
    if (!completed) return { valid: false, reason: 'quest not completed' };
    return { valid: true };
  }

  if (action === 'daily_checkin') {
    // Check if already claimed today
    const claimKey = `agora:claimed:${fid}:daily_checkin:${today()}`;
    const already = await redis.get(claimKey);
    if (already) return { valid: false, reason: 'daily check-in already claimed today' };
    return { valid: true };
  }

  if (action === 'deploy_api' || action === 'upgrade_tier') {
    // Verify game state exists
    const state = await redis.get(stateKey(fid));
    if (!state) return { valid: false, reason: 'no game state found' };
    return { valid: true };
  }

  if (action === 'tutorial_complete') {
    // Check not already claimed
    const claimKey = `agora:claimed:${fid}:tutorial_complete`;
    const already = await redis.get(claimKey);
    if (already) return { valid: false, reason: 'tutorial reward already claimed' };
    return { valid: true };
  }

  return { valid: false, reason: `unknown action: ${action}` };
}

// ─── POST /api/rewards ──────────────────────────────────────────────────────
// Body: { address, action, fid, questId? }
// Returns: { ticket, limits } or { error }

export async function POST(req: NextRequest) {
  const signerKey = process.env.REWARDS_SIGNER_KEY;
  if (!signerKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  let body: { address?: string; action?: string; fid?: number; questId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { address, action, fid, questId } = body;

  // ─── Input validation ──────────────────────────────────────────────────

  if (!address || !action || !fid) {
    return NextResponse.json({ error: 'Missing address, action, or fid' }, { status: 400 });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  if (typeof fid !== 'number' || fid <= 0 || !Number.isInteger(fid)) {
    return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
  }

  // ─── Farcaster identity verification ───────────────────────────────────

  const fidOwnsAddress = await verifyFidOwnsAddress(fid, address);
  if (!fidOwnsAddress) {
    return NextResponse.json({ error: 'Address not verified for this FID' }, { status: 403 });
  }

  // ─── Determine reward amount ──────────────────────────────────────────

  let amount: bigint;
  if (action === 'complete_quest') {
    if (!questId) {
      return NextResponse.json({ error: 'Missing questId for complete_quest' }, { status: 400 });
    }
    const quest = QUESTS.find(q => q.id === questId);
    if (!quest?.agoraReward) {
      return NextResponse.json({ error: `Unknown quest: ${questId}` }, { status: 400 });
    }
    amount = parseEther(String(quest.agoraReward));
  } else {
    const fixedAmount = REWARD_AMOUNTS[action];
    if (!fixedAmount) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    amount = fixedAmount;
  }

  // Enforce max claim amount
  if (amount > MAX_CLAIM_AMOUNT) {
    return NextResponse.json({ error: 'Claim amount exceeds maximum' }, { status: 400 });
  }

  // ─── Redis-backed rate limiting ────────────────────────────────────────

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Rate limiting unavailable' }, { status: 503 });
  }

  // Cooldown check
  const cooldownKey = `agora:cooldown:${fid}`;
  const cooldownActive = await redis.get(cooldownKey);
  if (cooldownActive) {
    const ttl = await redis.ttl(cooldownKey);
    return NextResponse.json(
      { error: 'Claim cooldown active', cooldown: ttl, limits: { nextClaimIn: ttl } },
      { status: 429 },
    );
  }

  // Daily claim counter
  const dailyKey = `agora:claims:${fid}:${today()}`;
  const dailyCount = await redis.get<number>(dailyKey) || 0;
  if (dailyCount >= MAX_CLAIMS_PER_DAY) {
    return NextResponse.json({ error: 'Daily claim limit reached' }, { status: 429 });
  }

  // Daily amount tracking
  const dailyAmountKey = `agora:daily-amount:${fid}:${today()}`;
  const dailyAmount = BigInt((await redis.get<string>(dailyAmountKey)) || '0');
  if (dailyAmount + amount > DAILY_CAP) {
    const remaining = DAILY_CAP - dailyAmount;
    return NextResponse.json(
      { error: 'Daily cap would be exceeded', limits: { dailyRemaining: remaining.toString() } },
      { status: 429 },
    );
  }

  // Lifetime tracking
  const lifetimeKey = `agora:lifetime:${fid}`;
  const lifetimeClaimed = BigInt((await redis.get<string>(lifetimeKey)) || '0');
  if (lifetimeClaimed + amount > LIFETIME_CAP) {
    const remaining = LIFETIME_CAP - lifetimeClaimed;
    return NextResponse.json(
      { error: 'Lifetime cap would be exceeded', limits: { lifetimeRemaining: remaining.toString() } },
      { status: 429 },
    );
  }

  // ─── Action verification ──────────────────────────────────────────────

  const actionCheck = await verifyAction(redis, fid, action, questId);
  if (!actionCheck.valid) {
    return NextResponse.json({ error: actionCheck.reason }, { status: 403 });
  }

  // ─── Duplicate prevention ─────────────────────────────────────────────

  // Include questId in dedup key for ALL actions (not just quests)
  // This allows per-occurrence claims: deploy_api:api-id, upgrade_tier:2, etc.
  const dedupId = questId ? `${action}:${questId}` : action;
  const dedupKey = `agora:claimed:${fid}:${dedupId}`;

  // One-time actions: no TTL. Daily actions: 24h TTL.
  const isDailyAction = action === 'daily_checkin';
  if (!isDailyAction) {
    const alreadyClaimed = await redis.get(dedupKey);
    if (alreadyClaimed) {
      return NextResponse.json({ error: 'Reward already claimed' }, { status: 409 });
    }
  }

  // ─── Generate nonce + sign ticket ─────────────────────────────────────

  const nonce = BigInt(Date.now()) * BigInt(1000) + BigInt(Math.floor(Math.random() * 1000));

  // V2 signature: includes fid
  const messageHash = keccak256(
    encodeAbiParameters(
      [
        { name: 'player', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'fid', type: 'uint256' },
        { name: 'chainId', type: 'uint256' },
        { name: 'contract', type: 'address' },
      ],
      [
        address as `0x${string}`,
        amount,
        nonce,
        BigInt(fid),
        BigInt(CHAIN_ID),
        REWARDS_CONTRACT as `0x${string}`,
      ],
    ),
  );

  const account = privateKeyToAccount(signerKey as `0x${string}`);
  const signature = await account.signMessage({ message: { raw: messageHash } });

  // ─── Record claim in Redis ────────────────────────────────────────────

  // Pipeline all writes
  const pipeline = redis.pipeline();

  // Cooldown
  pipeline.set(cooldownKey, '1', { ex: COOLDOWN_SECONDS });

  // Daily counter
  pipeline.incr(dailyKey);
  pipeline.expire(dailyKey, 172800); // 48h TTL

  // Daily amount
  const newDailyAmount = (dailyAmount + amount).toString();
  pipeline.set(dailyAmountKey, newDailyAmount, { ex: 172800 });

  // Lifetime
  const newLifetime = (lifetimeClaimed + amount).toString();
  pipeline.set(lifetimeKey, newLifetime);

  // Dedup
  if (isDailyAction) {
    // daily_checkin uses date-scoped key (set by verifyAction check)
    pipeline.set(`agora:claimed:${fid}:daily_checkin:${today()}`, '1', { ex: 86400 });
  } else {
    pipeline.set(dedupKey, '1');
  }

  await pipeline.exec();

  // ─── Response with cap warnings ───────────────────────────────────────

  const dailyRemaining = (DAILY_CAP - dailyAmount - amount).toString();
  const lifetimeRemaining = (LIFETIME_CAP - lifetimeClaimed - amount).toString();

  return NextResponse.json({
    ticket: {
      amount: amount.toString(),
      nonce: nonce.toString(),
      fid,
      signature,
    },
    limits: {
      dailyRemaining,
      lifetimeRemaining,
      nextClaimAt: Math.floor(Date.now() / 1000) + COOLDOWN_SECONDS,
      claimsToday: dailyCount + 1,
      maxClaimsPerDay: MAX_CLAIMS_PER_DAY,
    },
  });
}

// ─── GET /api/rewards — Pool stats ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get('fid');

  const base = {
    contract: REWARDS_CONTRACT,
    chainId: CHAIN_ID,
    actions: Object.fromEntries(
      Object.entries(REWARD_AMOUNTS).map(([k, v]) => [k, v.toString()]),
    ),
    limits: {
      maxClaimAmount: MAX_CLAIM_AMOUNT.toString(),
      dailyCap: DAILY_CAP.toString(),
      lifetimeCap: LIFETIME_CAP.toString(),
      cooldownSeconds: COOLDOWN_SECONDS,
    },
  };

  // If FID provided, include their remaining caps
  if (fid) {
    const redis = getRedis();
    if (redis) {
      const dailyAmountKey = `agora:daily-amount:${fid}:${today()}`;
      const lifetimeKey = `agora:lifetime:${fid}`;
      const dailyAmount = BigInt((await redis.get<string>(dailyAmountKey)) || '0');
      const lifetimeClaimed = BigInt((await redis.get<string>(lifetimeKey)) || '0');

      return NextResponse.json({
        ...base,
        player: {
          fid: Number(fid),
          dailyRemaining: (DAILY_CAP - dailyAmount).toString(),
          lifetimeRemaining: (LIFETIME_CAP - lifetimeClaimed).toString(),
        },
      });
    }
  }

  return NextResponse.json(base);
}
