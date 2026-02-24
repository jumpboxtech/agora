'use client';

import { useReadContracts } from 'wagmi';
import { formatEther } from 'viem';
import {
  AGORA_TOKEN, AGORA_STAKING, AGORA_AGENT_SUB, AGORA_REWARDS_V2, DEAD_ADDRESS,
  ERC20_ABI, STAKING_ABI, AGENT_SUB_ABI, REWARDS_V2_ABI,
} from './contracts';

const TOKEN = AGORA_TOKEN as `0x${string}`;
const STAKING = AGORA_STAKING as `0x${string}`;
const SUB = AGORA_AGENT_SUB as `0x${string}`;
const REWARDS = AGORA_REWARDS_V2 as `0x${string}`;
const DEAD = DEAD_ADDRESS as `0x${string}`;

export function useProtocolStats() {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: TOKEN, abi: ERC20_ABI, functionName: 'totalSupply' },              // 0
      { address: TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [DEAD] },  // 1
      { address: TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [STAKING] }, // 2
      { address: TOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [REWARDS] }, // 3
      { address: STAKING, abi: STAKING_ABI, functionName: 'totalStaked' },           // 4
      { address: STAKING, abi: STAKING_ABI, functionName: 'totalBurned' },           // 5
      { address: STAKING, abi: STAKING_ABI, functionName: 'totalCommitted' },        // 6
      { address: SUB, abi: AGENT_SUB_ABI, functionName: 'totalBurned' },             // 7
      { address: SUB, abi: AGENT_SUB_ABI, functionName: 'totalActiveSubscriptions' }, // 8
      { address: REWARDS, abi: REWARDS_V2_ABI, functionName: 'totalDistributed' },      // 9
      { address: REWARDS, abi: REWARDS_V2_ABI, functionName: 'totalClaims' },           // 10
      { address: REWARDS, abi: REWARDS_V2_ABI, functionName: 'poolBalance' },           // 11
    ],
    query: { refetchInterval: 30_000 },
  });

  const get = (i: number): bigint => {
    if (!data || !data[i] || data[i].status !== 'success') return BigInt(0);
    return data[i].result as bigint;
  };

  const totalSupply = get(0);
  const totalBurnedAll = get(1);
  const stakingLocked = get(2);
  const rewardPoolActual = get(3);
  const totalStaked = get(4);
  const stakingBurned = get(5);
  const totalCommitted = get(6);
  const subBurned = get(7);
  const activeSubscriptions = Number(get(8));
  const totalDistributed = get(9);
  const totalClaims = Number(get(10));
  const poolBalance = get(11);

  const circulating = totalSupply > BigInt(0)
    ? totalSupply - totalBurnedAll - stakingLocked - rewardPoolActual
    : BigInt(0);

  return {
    totalSupply,
    totalBurnedAll,
    stakingLocked,
    rewardPoolActual,
    totalStaked,
    stakingBurned,
    totalCommitted,
    subBurned,
    activeSubscriptions,
    totalDistributed,
    totalClaims,
    poolBalance,
    circulating,
    isLoading,
    refetch,
  };
}

/** Format bigint wei to human-readable number for charts */
export function weiToNumber(wei: bigint): number {
  return Number(formatEther(wei));
}
