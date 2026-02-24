'use client';

import { useState, useCallback } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { AGORA_AGENT_SUB, USDC_BASE, AGENT_SUB_ABI, ERC20_ABI } from './contracts';

const SUB_ADDR = AGORA_AGENT_SUB as `0x${string}`;
const USDC_ADDR = USDC_BASE as `0x${string}`;

type LastAction = 'approve' | 'subscribe' | 'renew' | 'updateAgent' | null;

export function useAgoraAgentSub(address: `0x${string}` | undefined) {
  const [lastAction, setLastAction] = useState<LastAction>(null);
  // ─── Read on-chain state ──────────────────────────────────────────────────

  const { data: subData, refetch: refetchSub } = useReadContract({
    address: SUB_ADDR,
    abi: AGENT_SUB_ABI,
    functionName: 'getSubscription',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDR,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, SUB_ADDR] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDR,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
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
    setLastAction('approve');
    writeContract({
      address: USDC_ADDR,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [SUB_ADDR, amount],
    });
  };

  const subscribe = (tier: number, agentName: string, payTo: `0x${string}`) => {
    setLastAction('subscribe');
    writeContract({
      address: SUB_ADDR,
      abi: AGENT_SUB_ABI,
      functionName: 'subscribe',
      args: [tier, agentName, payTo],
    });
  };

  const renew = () => {
    setLastAction('renew');
    writeContract({
      address: SUB_ADDR,
      abi: AGENT_SUB_ABI,
      functionName: 'renew',
    });
  };

  const updateAgent = (agentName: string, payTo: `0x${string}`) => {
    setLastAction('updateAgent');
    writeContract({
      address: SUB_ADDR,
      abi: AGENT_SUB_ABI,
      functionName: 'updateAgent',
      args: [agentName, payTo],
    });
  };

  const resetAction = useCallback(() => {
    reset();
    setLastAction(null);
  }, [reset]);

  const refetchAll = () => {
    refetchSub();
    refetchAllowance();
    refetchBalance();
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

  const balance = (usdcBalance as bigint) ?? BigInt(0);

  return {
    // Subscription state
    tier,
    expiresAt,
    agentName,
    payTo,
    active,
    // USDC balance + approval
    balance,
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
    reset: resetAction,
    // Tx state
    txHash,
    isWriting,
    isConfirming,
    isConfirmed,
    isPending: isWriting || isConfirming,
    // Track which action triggered the tx (approve vs subscribe vs renew)
    lastAction,
  };
}

// ─── Subscription tier definitions (USDC, 6 decimals) ─────────────────────

export const SUB_TIERS = [
  { tier: 1, name: 'Starter', cost: BigInt(10_000_000), label: '10 USDC', usd: '$10/mo' },
  { tier: 2, name: 'Pro', cost: BigInt(25_000_000), label: '25 USDC', usd: '$25/mo' },
  { tier: 3, name: 'Enterprise', cost: BigInt(50_000_000), label: '50 USDC', usd: '$50/mo' },
] as const;
