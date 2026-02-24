'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { AGORA_REWARDS_V2, REWARDS_V2_ABI } from './contracts';

const REWARDS_ADDR = AGORA_REWARDS_V2 as `0x${string}`;

export interface ClaimTicket {
  amount: bigint;
  nonce: bigint;
  fid: bigint;
  signature: `0x${string}`;
}

export function useAgoraRewards(address: `0x${string}` | undefined) {
  // ─── Read on-chain state ──────────────────────────────────────────────────

  const { data: userClaimed, refetch: refetchClaimed } = useReadContract({
    address: REWARDS_ADDR,
    abi: REWARDS_V2_ABI,
    functionName: 'totalClaimed',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: poolBalance } = useReadContract({
    address: REWARDS_ADDR,
    abi: REWARDS_V2_ABI,
    functionName: 'poolBalance',
    query: { refetchInterval: 30_000 },
  });

  const { data: totalDistributed } = useReadContract({
    address: REWARDS_ADDR,
    abi: REWARDS_V2_ABI,
    functionName: 'totalDistributed',
    query: { refetchInterval: 30_000 },
  });

  const { data: totalClaims } = useReadContract({
    address: REWARDS_ADDR,
    abi: REWARDS_V2_ABI,
    functionName: 'totalClaims',
    query: { refetchInterval: 30_000 },
  });

  // ─── Write contract ───────────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending: isWriting, reset, isError: isWriteError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // ─── Claim action (V2: includes fid) ────────────────────────────────────

  const claim = (ticket: ClaimTicket) => {
    writeContract({
      address: REWARDS_ADDR,
      abi: REWARDS_V2_ABI,
      functionName: 'claim',
      args: [ticket.amount, ticket.nonce, ticket.fid, ticket.signature],
    });
  };

  return {
    // User state
    userClaimed: (userClaimed as bigint) ?? BigInt(0),
    // Global stats
    poolBalance: (poolBalance as bigint) ?? BigInt(0),
    totalDistributed: (totalDistributed as bigint) ?? BigInt(0),
    totalClaims: totalClaims ? Number(totalClaims) : 0,
    // Actions
    claim,
    refetchClaimed,
    reset,
    // Tx state
    txHash,
    isWriting,
    isConfirming,
    isConfirmed,
    isWriteError,
    isPending: isWriting || isConfirming,
  };
}
