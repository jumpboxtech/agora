'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import {
  AGORA_TOKEN,
  AGORA_LAUNCHPAD,
  AGORA_ENDPOINT_REGISTRY,
  LAUNCHPAD_ABI,
  ENDPOINT_REGISTRY_ABI,
  ERC20_ABI,
} from './contracts';

const LP_ADDR = AGORA_LAUNCHPAD as `0x${string}`;
const REG_ADDR = AGORA_ENDPOINT_REGISTRY as `0x${string}`;
const TOKEN_ADDR = AGORA_TOKEN as `0x${string}`;

// ─── Curve data type ─────────────────────────────────────────────────────────

export type CurveData = {
  creator: string;
  token: string;
  totalSupply: bigint;
  virtualAgora: bigint;
  k: bigint;
  agoraReserve: bigint;
  tokensSold: bigint;
  graduationAgora: bigint;
  feeBps: bigint;
  accruedFees: bigint;
  graduated: boolean;
  createdAt: bigint;
  creatorShareBps: bigint;
  uniswapPool: string;
};

export type EndpointData = {
  path: string;
  priceAgora: bigint;
  paymentMode: number;
  active: boolean;
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAgoraLaunchpad(address: `0x${string}` | undefined) {
  // ─── Read: has this agent launched? ─────────────────────────────────────────

  const { data: launched, refetch: refetchLaunched } = useReadContract({
    address: LP_ADDR,
    abi: LAUNCHPAD_ABI,
    functionName: 'hasLaunched',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: curveIdRaw, refetch: refetchCurveId } = useReadContract({
    address: LP_ADDR,
    abi: LAUNCHPAD_ABI,
    functionName: 'getAgentCurve',
    args: address ? [address] : undefined,
    query: { enabled: !!address && launched === true, refetchInterval: 15_000 },
  });

  const curveId = curveIdRaw !== undefined ? Number(curveIdRaw) : undefined;

  // ─── Read: curve data ───────────────────────────────────────────────────────

  const { data: curveRaw, refetch: refetchCurve } = useReadContract({
    address: LP_ADDR,
    abi: LAUNCHPAD_ABI,
    functionName: 'getCurve',
    args: curveId !== undefined ? [BigInt(curveId)] : undefined,
    query: { enabled: curveId !== undefined, refetchInterval: 15_000 },
  });

  const curve = curveRaw as CurveData | undefined;

  // ─── Read: price ────────────────────────────────────────────────────────────

  const { data: priceRaw } = useReadContract({
    address: LP_ADDR,
    abi: LAUNCHPAD_ABI,
    functionName: 'getPrice',
    args: curveId !== undefined ? [BigInt(curveId)] : undefined,
    query: { enabled: curveId !== undefined, refetchInterval: 15_000 },
  });

  // ─── Read: global stats ─────────────────────────────────────────────────────

  const { data: totalCurvesRaw } = useReadContract({
    address: LP_ADDR,
    abi: LAUNCHPAD_ABI,
    functionName: 'totalCurves',
    query: { refetchInterval: 30_000 },
  });

  // ─── Read: allowance for launchpad ──────────────────────────────────────────

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDR,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, LP_ADDR] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  // ─── Read: endpoint registry profile ────────────────────────────────────────

  const { data: profileRaw, refetch: refetchProfile } = useReadContract({
    address: REG_ADDR,
    abi: ENDPOINT_REGISTRY_ABI,
    functionName: 'profiles',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: endpointsRaw, refetch: refetchEndpoints } = useReadContract({
    address: REG_ADDR,
    abi: ENDPOINT_REGISTRY_ABI,
    functionName: 'getAgentEndpoints',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  // ─── Write ──────────────────────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // ─── Actions ────────────────────────────────────────────────────────────────

  const approveLaunchpad = (amount: bigint) => {
    writeContract({
      address: TOKEN_ADDR,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [LP_ADDR, amount],
    });
  };

  const launch = (name: string, symbol: string) => {
    writeContract({
      address: LP_ADDR,
      abi: LAUNCHPAD_ABI,
      functionName: 'launch',
      args: [name, symbol],
    });
  };

  const buy = (curveId_: number, agoraAmount: bigint, minTokensOut: bigint) => {
    writeContract({
      address: LP_ADDR,
      abi: LAUNCHPAD_ABI,
      functionName: 'buy',
      args: [BigInt(curveId_), agoraAmount, minTokensOut],
    });
  };

  const sell = (curveId_: number, tokenAmount: bigint, minAgoraOut: bigint) => {
    writeContract({
      address: LP_ADDR,
      abi: LAUNCHPAD_ABI,
      functionName: 'sell',
      args: [BigInt(curveId_), tokenAmount, minAgoraOut],
    });
  };

  const registerEndpoints = (
    endpointUrl: string,
    paths: string[],
    prices: bigint[],
    modes: number[],
  ) => {
    writeContract({
      address: REG_ADDR,
      abi: ENDPOINT_REGISTRY_ABI,
      functionName: 'registerEndpoints',
      args: [endpointUrl, paths, prices, modes],
    });
  };

  const updateEndpoint = (path: string, priceAgora: bigint, paymentMode: number) => {
    writeContract({
      address: REG_ADDR,
      abi: ENDPOINT_REGISTRY_ABI,
      functionName: 'updateEndpoint',
      args: [path, priceAgora, paymentMode],
    });
  };

  const removeEndpoint = (path: string) => {
    writeContract({
      address: REG_ADDR,
      abi: ENDPOINT_REGISTRY_ABI,
      functionName: 'removeEndpoint',
      args: [path],
    });
  };

  const refetchAll = () => {
    refetchLaunched();
    refetchCurveId();
    refetchCurve();
    refetchAllowance();
    refetchProfile();
    refetchEndpoints();
  };

  // ─── Parsed values ─────────────────────────────────────────────────────────

  const profile = profileRaw
    ? {
        endpointUrl: (profileRaw as [string, bigint, bigint, bigint])[0],
        totalTasks: Number((profileRaw as [string, bigint, bigint, bigint])[1]),
        totalEarned: (profileRaw as [string, bigint, bigint, bigint])[2],
        endpointCount: Number((profileRaw as [string, bigint, bigint, bigint])[3]),
      }
    : undefined;

  const endpoints = endpointsRaw as EndpointData[] | undefined;

  const currentAllowance = (allowance as bigint) ?? BigInt(0);
  const needsApproval = (amount: bigint) => currentAllowance < amount;

  // Graduation progress
  const graduationPct =
    curve && curve.graduationAgora > BigInt(0)
      ? Math.min(100, Number((curve.agoraReserve * BigInt(100)) / curve.graduationAgora))
      : 0;

  const price = priceRaw ? Number(formatEther(priceRaw as bigint)) : 0;

  return {
    // Curve state
    hasLaunched: launched === true,
    curveId,
    curve,
    price,
    graduationPct,
    // Endpoint registry
    profile,
    endpoints,
    // Token approval
    currentAllowance,
    needsApproval,
    // Global stats
    totalCurves: totalCurvesRaw ? Number(totalCurvesRaw) : 0,
    // Actions
    approveLaunchpad,
    launch,
    buy,
    sell,
    registerEndpoints,
    updateEndpoint,
    removeEndpoint,
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
