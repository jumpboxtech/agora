'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { AGORA_TOKEN, AGORA_STAKING, STAKING_ABI, ERC20_ABI } from './contracts';

const STAKING_ADDR = AGORA_STAKING as `0x${string}`;
const TOKEN_ADDR = AGORA_TOKEN as `0x${string}`;

export function useAgoraStaking(address: `0x${string}` | undefined) {
  // ─── Read on-chain state ──────────────────────────────────────────────────

  const { data: stakeData, refetch: refetchStake } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: 'getUserStake',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const { data: tokenBalance, refetch: refetchBalance } = useReadContract({
    address: TOKEN_ADDR,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDR,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, STAKING_ADDR] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: globalStaked } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: 'totalStaked',
    query: { refetchInterval: 30_000 },
  });

  const { data: globalBurned } = useReadContract({
    address: STAKING_ADDR,
    abi: STAKING_ABI,
    functionName: 'totalBurned',
    query: { refetchInterval: 30_000 },
  });

  // ─── Write contract ───────────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // ─── Actions ──────────────────────────────────────────────────────────────

  const approve = (amount: bigint) => {
    writeContract({
      address: TOKEN_ADDR,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [STAKING_ADDR, amount],
    });
  };

  const stake = (amount: bigint) => {
    writeContract({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: 'stake',
      args: [amount],
    });
  };

  const initiateUnstake = (amount: bigint) => {
    writeContract({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: 'initiateUnstake',
      args: [amount],
    });
  };

  const claimUnstake = () => {
    writeContract({
      address: STAKING_ADDR,
      abi: STAKING_ABI,
      functionName: 'claimUnstake',
    });
  };

  const refetchAll = () => {
    refetchStake();
    refetchBalance();
    refetchAllowance();
  };

  // ─── Parsed values ────────────────────────────────────────────────────────

  const staked = stakeData ? (stakeData as [bigint, bigint, bigint, number, bigint])[0] : BigInt(0);
  const unstaking = stakeData ? (stakeData as [bigint, bigint, bigint, number, bigint])[1] : BigInt(0);
  const unstakeAt = stakeData ? Number((stakeData as [bigint, bigint, bigint, number, bigint])[2]) : 0;
  const onChainTier = stakeData ? Number((stakeData as [bigint, bigint, bigint, number, bigint])[3]) : 0;
  const bonusBps = stakeData ? (stakeData as [bigint, bigint, bigint, number, bigint])[4] : BigInt(0);

  const balance = tokenBalance as bigint | undefined;
  const currentAllowance = allowance as bigint | undefined;
  const needsApproval = (amount: bigint) => {
    if (!currentAllowance) return true;
    return currentAllowance < amount;
  };

  return {
    // On-chain staking state
    staked,
    unstaking,
    unstakeAt,
    onChainTier,
    bonusBps,
    // Token
    balance: balance ?? BigInt(0),
    currentAllowance: currentAllowance ?? BigInt(0),
    needsApproval,
    // Global stats
    globalStaked: (globalStaked as bigint) ?? BigInt(0),
    globalBurned: (globalBurned as bigint) ?? BigInt(0),
    // Actions
    approve,
    stake,
    initiateUnstake,
    claimUnstake,
    refetchAll,
    reset,
    // Tx state
    txHash,
    isWriting,
    isConfirming,
    isConfirmed,
    isPending: isWriting || isConfirming,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format bigint wei to human-readable with suffix */
export function formatTokenAmount(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
}

/** Staking tier thresholds in wei (must match contract) */
export const STAKE_TIERS_WEI = [
  { threshold: parseEther('10000000'),    label: '10M',  bonus: '+5%' },
  { threshold: parseEther('100000000'),   label: '100M', bonus: '+15%' },
  { threshold: parseEther('1000000000'),  label: '1B',   bonus: '+30%' },
  { threshold: parseEther('10000000000'), label: '10B',  bonus: '+50%' },
] as const;
