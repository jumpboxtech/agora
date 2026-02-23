// staking.ts — $AGORA staking tiers, bonuses, and burn mechanics

export interface StakingTier {
  threshold: number; // $AGORA required
  bonus: number;     // multiplier added to revenue (e.g. 0.05 = +5%)
  label: string;
}

export const STAKING_TIERS: StakingTier[] = [
  { threshold: 10_000_000, bonus: 0.05, label: '10M' },
  { threshold: 100_000_000, bonus: 0.15, label: '100M' },
  { threshold: 1_000_000_000, bonus: 0.30, label: '1B' },
  { threshold: 10_000_000_000, bonus: 0.50, label: '10B' },
];

export const UNSTAKE_COOLDOWN_MS = 30 * 1000; // 30 seconds
export const BURN_RATE = 0.01; // 1% burn on staking reward claims

/** Get the current staking tier index (-1 = no tier) */
export function getStakeTierIndex(staked: number): number {
  for (let i = STAKING_TIERS.length - 1; i >= 0; i--) {
    if (staked >= STAKING_TIERS[i].threshold) return i;
  }
  return -1;
}

/** Get the bonus multiplier for a staked amount (1.0 = no bonus) */
export function getStakeBonus(staked: number): number {
  const tierIdx = getStakeTierIndex(staked);
  if (tierIdx < 0) return 1.0;
  return 1.0 + STAKING_TIERS[tierIdx].bonus;
}

/** Get the label for current staking tier */
export function getStakeLabel(staked: number): string | null {
  const tierIdx = getStakeTierIndex(staked);
  if (tierIdx < 0) return null;
  return STAKING_TIERS[tierIdx].label;
}

/** Get next tier info (for progress bar) */
export function getNextTier(staked: number): { threshold: number; label: string } | null {
  const tierIdx = getStakeTierIndex(staked);
  const nextIdx = tierIdx + 1;
  if (nextIdx >= STAKING_TIERS.length) return null;
  return STAKING_TIERS[nextIdx];
}

/** Calculate burn amount for a claim */
export function calcBurnAmount(claimAmount: number): number {
  return Math.floor(claimAmount * BURN_RATE);
}

// ─── Burn-to-boost permanent upgrades ─────────────────────────────────────────

export interface BurnBoost {
  id: string;
  name: string;
  description: string;
  cost: number;   // $AGORA to burn
  stat: string;   // which stat to boost
  value: number;  // amount to add
}

export const BURN_BOOSTS: BurnBoost[] = [
  { id: 'acc_1', name: '+1% Accuracy', description: 'Permanent filter accuracy', cost: 5000, stat: 'accuracy', value: 0.01 },
  { id: 'acc_2', name: '+2% Accuracy', description: 'Permanent filter accuracy', cost: 15000, stat: 'accuracy', value: 0.02 },
  { id: 'bw_1', name: '+5% Bandwidth', description: 'Permanent bandwidth', cost: 10000, stat: 'bandwidth', value: 0.05 },
  { id: 'bw_2', name: '+10% Bandwidth', description: 'Permanent bandwidth', cost: 30000, stat: 'bandwidth', value: 0.10 },
  { id: 'rev_1', name: '+3% Revenue', description: 'Permanent revenue per req', cost: 8000, stat: 'revenue', value: 0.03 },
  { id: 'rev_2', name: '+6% Revenue', description: 'Permanent revenue per req', cost: 25000, stat: 'revenue', value: 0.06 },
];
