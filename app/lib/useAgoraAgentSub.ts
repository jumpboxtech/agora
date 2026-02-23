'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { AGORA_TOKEN, AGORA_AGENT_SUB, AGENT_SUB_ABI, ERC20_ABI } from './contracts';

const SUB_ADDR = AGORA_AGENT_SUB as `0x${string}`;
const TOKEN_ADDR = AGORA_TOKEN as `0x${string}`;

export function useAgoraAgentSub(address: `0x${string}` | undefined) {
  // ─── Read on-chain state ──────────────────────────────────────────────────

  const { data: subData, refetch: refetchSub } = useReadContract({
    address: SUB_ADDR,
    abi: AGENT_SUB_ABI,
    functionName: 'getSubscription',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDR,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, SUB_ADDR] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: totalBurned } = useReadContract({
    address: SUB_ADDR,
    abi: AGENT_SUB_ABI,
    functionName: 'totalBurned',
    query: { refetchInterval: 30_000 },
  });

  const { data: totalActive } = useReadContract({
    address: SUB_ADDR,
    abi: AGENT_SUB_ABI,
    functionName: 'totalActiveSubscriptions',
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
      args: [SUB_ADDR, amount],
    });
  };

  const subscribe = (tier: number, agentName: string, payTo: `0x${string}`) => {
    writeContract({
      address: SUB_ADDR,
      abi: AGENT_SUB_ABI,
      functionName: 'subscribe',
      args: [tier, agentName, payTo],
    });
  };

  const renew = () => {
    writeContract({
      address: SUB_ADDR,
      abi: AGENT_SUB_ABI,
      functionName: 'renew',
    });
  };

  const updateAgent = (agentName: string, payTo: `0x${string}`) => {
    writeContract({
      address: SUB_ADDR,
      abi: AGENT_SUB_ABI,
      functionName: 'updateAgent',
      args: [agentName, payTo],
    });
  };

  const refetchAll = () => {
    refetchSub();
    refetchAllowance();
  };

  // ─── Parsed values ────────────────────────────────────────────────────────

  const tier = subData ? Number((subData as [number, bigint, string, string, boolean])[0]) : 0;
  const expiresAt = subData ? Number((subData as [number, bigint, string, string, boolean])[1]) : 0;
  const agentName = subData ? (subData as [number, bigint, string, string, boolean])[2] : '';
  const payTo = subData ? (subData as [number, bigint, string, string, boolean])[3] : '';
  const active = subData ? (subData as [number, bigint, string, string, boolean])[4] : false;

  const currentAllowance = allowance as bigint | undefined;
  const needsApproval = (amount: bigint) => {
    if (!currentAllowance) return true;
    return currentAllowance < amount;
  };

  return {
    // Subscription state
    tier,
    expiresAt,
    agentName,
    payTo,
    active,
    // Token approval
    currentAllowance: currentAllowance ?? BigInt(0),
    needsApproval,
    // Global stats
    totalBurned: (totalBurned as bigint) ?? BigInt(0),
    totalActive: totalActive ? Number(totalActive) : 0,
    // Actions
    approve,
    subscribe,
    renew,
    updateAgent,
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

// ─── Subscription tier definitions ───────────────────────────────────────────

export const SUB_TIERS = [
  { tier: 1, name: 'Starter', cost: parseEther('50000000'), label: '50M/mo' },
  { tier: 2, name: 'Pro', cost: parseEther('100000000'), label: '100M/mo' },
  { tier: 3, name: 'Enterprise', cost: parseEther('250000000'), label: '250M/mo' },
] as const;
