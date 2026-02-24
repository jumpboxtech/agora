import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import {
  AGORA_LAUNCHPAD,
  AGORA_ENDPOINT_REGISTRY,
  AGORA_AGENT_SUB,
  LAUNCHPAD_ABI,
  ENDPOINT_REGISTRY_ABI,
  AGENT_SUB_ABI,
} from './contracts';

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type CurveInfo = {
  curveId: number;
  creator: string;
  token: string;
  totalSupply: string;
  agoraReserve: string;
  tokensSold: string;
  graduationAgora: string;
  graduationPct: number;
  price: string;
  graduated: boolean;
  createdAt: number;
  feeBps: number;
};

export type AgentSignals = {
  address: string;
  totalTasks: number;
  totalEarned: string;
  endpointCount: number;
  endpointUrl: string;
  hasToken: boolean;
  curveId: number | null;
  price: string | null;
  graduationPct: number | null;
};

export type AgentDirectoryEntry = {
  address: string;
  name: string;
  tier: number;
  payTo: string;
  active: boolean;
  endpointUrl: string;
  totalTasks: number;
  totalEarned: string;
  endpointCount: number;
  hasToken: boolean;
  endpoints: { path: string; priceAgora: string; paymentMode: number; active: boolean }[];
};

// ─── Curve Data ─────────────────────────────────────────────────────────────

export async function getCurveData(curveId: number): Promise<CurveInfo | null> {
  try {
    const curve = await client.readContract({
      address: AGORA_LAUNCHPAD as `0x${string}`,
      abi: LAUNCHPAD_ABI,
      functionName: 'getCurve',
      args: [BigInt(curveId)],
    }) as {
      creator: string; token: string; totalSupply: bigint; virtualAgora: bigint;
      k: bigint; agoraReserve: bigint; tokensSold: bigint; graduationAgora: bigint;
      feeBps: bigint; accruedFees: bigint; graduated: boolean; createdAt: bigint;
      creatorShareBps: bigint; uniswapPool: string;
    };

    const price = await client.readContract({
      address: AGORA_LAUNCHPAD as `0x${string}`,
      abi: LAUNCHPAD_ABI,
      functionName: 'getPrice',
      args: [BigInt(curveId)],
    }) as bigint;

    const graduationPct = curve.graduationAgora > BigInt(0)
      ? Math.min(100, Number((curve.agoraReserve * BigInt(100)) / curve.graduationAgora))
      : 0;

    return {
      curveId,
      creator: curve.creator,
      token: curve.token,
      totalSupply: formatEther(curve.totalSupply),
      agoraReserve: formatEther(curve.agoraReserve),
      tokensSold: formatEther(curve.tokensSold),
      graduationAgora: formatEther(curve.graduationAgora),
      graduationPct,
      price: formatEther(price),
      graduated: curve.graduated,
      createdAt: Number(curve.createdAt),
      feeBps: Number(curve.feeBps),
    };
  } catch {
    return null;
  }
}

export async function getAllCurves(): Promise<CurveInfo[]> {
  const total = await client.readContract({
    address: AGORA_LAUNCHPAD as `0x${string}`,
    abi: LAUNCHPAD_ABI,
    functionName: 'totalCurves',
  }) as bigint;

  const curves: CurveInfo[] = [];
  for (let i = 0; i < Number(total); i++) {
    const c = await getCurveData(i);
    if (c) curves.push(c);
  }
  return curves;
}

// ─── Agent Signals ──────────────────────────────────────────────────────────

export async function getAgentSignals(address: string): Promise<AgentSignals | null> {
  try {
    const addr = address as `0x${string}`;

    const [profile, hasLaunched] = await Promise.all([
      client.readContract({
        address: AGORA_ENDPOINT_REGISTRY as `0x${string}`,
        abi: ENDPOINT_REGISTRY_ABI,
        functionName: 'profiles',
        args: [addr],
      }) as Promise<[string, bigint, bigint, bigint]>,
      client.readContract({
        address: AGORA_LAUNCHPAD as `0x${string}`,
        abi: LAUNCHPAD_ABI,
        functionName: 'hasLaunched',
        args: [addr],
      }) as Promise<boolean>,
    ]);

    let curveId: number | null = null;
    let price: string | null = null;
    let graduationPct: number | null = null;

    if (hasLaunched) {
      const cid = await client.readContract({
        address: AGORA_LAUNCHPAD as `0x${string}`,
        abi: LAUNCHPAD_ABI,
        functionName: 'getAgentCurve',
        args: [addr],
      }) as bigint;
      curveId = Number(cid);

      const curveData = await getCurveData(curveId);
      if (curveData) {
        price = curveData.price;
        graduationPct = curveData.graduationPct;
      }
    }

    return {
      address,
      totalTasks: Number(profile[1]),
      totalEarned: formatEther(profile[2]),
      endpointCount: Number(profile[3]),
      endpointUrl: profile[0],
      hasToken: hasLaunched,
      curveId,
      price,
      graduationPct,
    };
  } catch {
    return null;
  }
}

// ─── Agent Directory ────────────────────────────────────────────────────────

export async function getRegisteredAgents(offset = 0, limit = 20): Promise<AgentDirectoryEntry[]> {
  const total = await client.readContract({
    address: AGORA_ENDPOINT_REGISTRY as `0x${string}`,
    abi: ENDPOINT_REGISTRY_ABI,
    functionName: 'totalRegisteredAgents',
  }) as bigint;

  const count = Number(total);
  const start = Math.min(offset, count);
  const end = Math.min(start + limit, count);
  const entries: AgentDirectoryEntry[] = [];

  for (let i = start; i < end; i++) {
    const entry = await getAgentProfile(i);
    if (entry) entries.push(entry);
  }
  return entries;
}

async function getAgentProfile(index: number): Promise<AgentDirectoryEntry | null> {
  try {
    const addr = await client.readContract({
      address: AGORA_ENDPOINT_REGISTRY as `0x${string}`,
      abi: ENDPOINT_REGISTRY_ABI,
      functionName: 'getAgentAt',
      args: [BigInt(index)],
    }) as `0x${string}`;

    const [profile, sub, endpoints, hasLaunched] = await Promise.all([
      client.readContract({
        address: AGORA_ENDPOINT_REGISTRY as `0x${string}`,
        abi: ENDPOINT_REGISTRY_ABI,
        functionName: 'profiles',
        args: [addr],
      }) as Promise<[string, bigint, bigint, bigint]>,
      client.readContract({
        address: AGORA_AGENT_SUB as `0x${string}`,
        abi: AGENT_SUB_ABI,
        functionName: 'getSubscription',
        args: [addr],
      }) as Promise<[number, bigint, string, string, boolean]>,
      client.readContract({
        address: AGORA_ENDPOINT_REGISTRY as `0x${string}`,
        abi: ENDPOINT_REGISTRY_ABI,
        functionName: 'getAgentEndpoints',
        args: [addr],
      }) as Promise<{ path: string; priceAgora: bigint; paymentMode: number; active: boolean }[]>,
      client.readContract({
        address: AGORA_LAUNCHPAD as `0x${string}`,
        abi: LAUNCHPAD_ABI,
        functionName: 'hasLaunched',
        args: [addr],
      }) as Promise<boolean>,
    ]);

    return {
      address: addr,
      name: sub[2],
      tier: Number(sub[0]),
      payTo: sub[3],
      active: sub[4],
      endpointUrl: profile[0],
      totalTasks: Number(profile[1]),
      totalEarned: formatEther(profile[2]),
      endpointCount: Number(profile[3]),
      hasToken: hasLaunched,
      endpoints: (endpoints || []).map((e) => ({
        path: e.path,
        priceAgora: formatEther(e.priceAgora),
        paymentMode: Number(e.paymentMode),
        active: e.active,
      })),
    };
  } catch {
    return null;
  }
}
