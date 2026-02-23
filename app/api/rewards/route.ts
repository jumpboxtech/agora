import { NextRequest, NextResponse } from 'next/server';
import { keccak256, encodeAbiParameters, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { QUESTS } from '../../lib/quests';

// ─── Config ──────────────────────────────────────────────────────────────────

const REWARDS_CONTRACT = '0x0fdaB9D5e76E6b6Ba882044900c1976Dd7648c4b';
const CHAIN_ID = 8453; // Base mainnet

// Reward amounts in $AGORA (whole tokens, converted to wei)
const REWARD_AMOUNTS: Record<string, bigint> = {
  deploy_api:       parseEther('2000'),
  upgrade_tier:     parseEther('2000'),
  daily_checkin:    parseEther('1000'),
  tutorial_complete: parseEther('2000'),
};

// In-memory nonce counter (production: use KV/Redis)
let nonceCounter = Date.now();

// In-memory rate limiting per FID (production: use KV/Redis)
const dailyClaimsByFid = new Map<string, { date: string; count: number }>();
const MAX_CLAIMS_PER_DAY = 20;

// 24h cooldown for daily_checkin per FID (timestamp of last check-in)
const lastCheckinByFid = new Map<number, number>();
const CHECKIN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── POST /api/rewards ──────────────────────────────────────────────────────
// Body: { address, action, fid }
// Returns: { ticket: { amount, nonce, signature } } or { error }

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

  // Validate inputs
  if (!address || !action || !fid) {
    return NextResponse.json({ error: 'Missing address, action, or fid' }, { status: 400 });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  // Determine reward amount — quest rewards are looked up by questId
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

  // 24h cooldown for daily check-in
  if (action === 'daily_checkin') {
    const lastCheckin = lastCheckinByFid.get(fid);
    if (lastCheckin && Date.now() - lastCheckin < CHECKIN_COOLDOWN_MS) {
      const remaining = Math.ceil((CHECKIN_COOLDOWN_MS - (Date.now() - lastCheckin)) / 1000);
      return NextResponse.json({ error: 'Daily check-in already claimed', cooldown: remaining }, { status: 429 });
    }
  }

  // Rate limit per FID per day
  const today = new Date().toISOString().slice(0, 10);
  const key = `${fid}`;
  const entry = dailyClaimsByFid.get(key);
  if (entry && entry.date === today && entry.count >= MAX_CLAIMS_PER_DAY) {
    return NextResponse.json({ error: 'Daily claim limit reached' }, { status: 429 });
  }

  // Generate unique nonce
  const nonce = BigInt(nonceCounter++);

  // Sign the claim ticket
  // Message: keccak256(abi.encode(player, amount, nonce, chainId, contractAddress))
  const messageHash = keccak256(
    encodeAbiParameters(
      [
        { name: 'player', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'chainId', type: 'uint256' },
        { name: 'contract', type: 'address' },
      ],
      [
        address as `0x${string}`,
        amount,
        nonce,
        BigInt(CHAIN_ID),
        REWARDS_CONTRACT as `0x${string}`,
      ],
    ),
  );

  const account = privateKeyToAccount(signerKey as `0x${string}`);
  const signature = await account.signMessage({ message: { raw: messageHash } });

  // Update rate limit counter
  if (entry && entry.date === today) {
    entry.count++;
  } else {
    dailyClaimsByFid.set(key, { date: today, count: 1 });
  }

  // Track daily check-in timestamp
  if (action === 'daily_checkin') {
    lastCheckinByFid.set(fid, Date.now());
  }

  return NextResponse.json({
    ticket: {
      amount: amount.toString(),
      nonce: nonce.toString(),
      signature,
    },
  });
}

// ─── GET /api/rewards — Pool stats ──────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    contract: REWARDS_CONTRACT,
    chainId: CHAIN_ID,
    actions: Object.fromEntries(
      Object.entries(REWARD_AMOUNTS).map(([k, v]) => [k, v.toString()]),
    ),
  });
}
