// agora-token.ts — $AGORA token earning logic and formatting

// ─── Reward Amounts ──────────────────────────────────────────────────────────

export const AGORA_REWARDS = {
  deployApi: 2000,
  upgradeTier: 2000,
  completeTutorial: 2000,
  onChainSave: 500,
  dailyCheckin: 1000,
  castShare: 500,
  referral: 2500,
  // Quest rewards are defined per-quest in quests.ts
} as const;

// Leaderboard weekly rewards (top 10)
export const LEADERBOARD_REWARDS = [
  25000, 15000, 10000, 7500, 5000, 4000, 3000, 2000, 1500, 1000,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format large $AGORA amounts for display */
export function formatAgora(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
}

/** Format $AGORA with symbol */
export function formatAgoraWithSymbol(n: number): string {
  return formatAgora(n) + ' $AGORA';
}

/** Check if daily check-in is available (once per UTC day) */
export function canDailyCheckin(lastCheckinTimestamp: number): boolean {
  if (lastCheckinTimestamp === 0) return true;
  const now = new Date();
  const last = new Date(lastCheckinTimestamp);
  return (
    now.getUTCFullYear() !== last.getUTCFullYear() ||
    now.getUTCMonth() !== last.getUTCMonth() ||
    now.getUTCDate() !== last.getUTCDate()
  );
}

/** Estimate USD value at 25K MC */
export function agoraToUsd(agoraAmount: number, marketCap: number = 25000): string {
  const supply = 100_000_000_000; // 100B
  const price = marketCap / supply;
  const usd = agoraAmount * price;
  if (usd < 0.01) return '<$0.01';
  if (usd < 1) return '$' + usd.toFixed(4);
  return '$' + usd.toFixed(2);
}
