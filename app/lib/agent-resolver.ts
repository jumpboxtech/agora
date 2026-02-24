import { createPublicClient, http, keccak256, toHex } from 'viem';
import { base } from 'viem/chains';
import { getRedis } from './redis';
import {
  AGORA_AGENT_SUB,
  AGORA_ENDPOINT_REGISTRY,
  AGORA_LAUNCHPAD,
  AGENT_SUB_ABI,
  ENDPOINT_REGISTRY_ABI,
  LAUNCHPAD_ABI,
} from './contracts';

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type ResolvedAgent = {
  address: string;
  name: string;
  payTo: string;
  tier: number;
  active: boolean;
  endpointUrl: string;
  endpoints: { path: string; priceAgora: bigint; paymentMode: number; active: boolean }[];
  curveId: number | null;
  hasToken: boolean;
};

// ─── Cache ──────────────────────────────────────────────────────────────────

const cache = new Map<string, { agent: ResolvedAgent; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

// ─── KV Keys ────────────────────────────────────────────────────────────────

export const agentNameKey = (name: string) => `agent:name:${name.toLowerCase()}`;
export const agentAddrKey = (addr: string) => `agent:addr:${addr.toLowerCase()}`;

// ─── Registration ───────────────────────────────────────────────────────────

export async function registerAgentName(name: string, address: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const existing = await redis.get(agentNameKey(name));
  if (existing) return false;

  await redis.set(agentNameKey(name), { address: address.toLowerCase(), registeredAt: Date.now() });
  await redis.set(agentAddrKey(address), { name: name.toLowerCase(), registeredAt: Date.now() });
  return true;
}

export async function isNameAvailable(name: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  const existing = await redis.get(agentNameKey(name));
  return !existing;
}

export async function getNameForAddress(address: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const data = await redis.get(agentAddrKey(address)) as { name: string } | null;
  return data?.name ?? null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const NAME_OWNER_ABI = [
  {
    name: 'nameOwner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

/** Compute keccak256 of the name bytes, matching Solidity's keccak256(bytes(name)) */
function nameToHash(name: string): `0x${string}` {
  return keccak256(toHex(name));
}

// ─── Resolution ─────────────────────────────────────────────────────────────

export async function resolveAgent(nameOrAddress: string): Promise<ResolvedAgent | null> {
  const key = nameOrAddress.toLowerCase();

  // Check cache
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.agent;

  let address: string;

  // If it looks like an address, use directly
  if (key.startsWith('0x') && key.length === 42) {
    address = key;
  } else {
    // Look up name in KV first
    const redis = getRedis();
    let kvData: { address: string } | null = null;
    if (redis) {
      kvData = await redis.get(agentNameKey(key)) as { address: string } | null;
    }

    if (kvData) {
      address = kvData.address;
    } else {
      // Fallback: check on-chain nameOwner(keccak256(name)) mapping
      try {
        const nameOwner = await client.readContract({
          address: AGORA_AGENT_SUB as `0x${string}`,
          abi: NAME_OWNER_ABI,
          functionName: 'nameOwner',
          args: [nameToHash(key)],
        }) as string;

        if (!nameOwner || nameOwner === ZERO_ADDR) return null;
        address = nameOwner;

        // Backfill KV so future lookups skip the RPC call
        if (redis) {
          await redis.set(agentNameKey(key), { address: nameOwner.toLowerCase(), registeredAt: Date.now() }).catch(() => {});
          await redis.set(agentAddrKey(nameOwner), { name: key, registeredAt: Date.now() }).catch(() => {});
        }
      } catch {
        return null;
      }
    }
  }

  try {
    const addr = address as `0x${string}`;

    const [sub, profile, endpoints, hasLaunched] = await Promise.all([
      client.readContract({
        address: AGORA_AGENT_SUB as `0x${string}`,
        abi: AGENT_SUB_ABI,
        functionName: 'getSubscription',
        args: [addr],
      }) as Promise<[number, bigint, string, string, boolean]>,
      client.readContract({
        address: AGORA_ENDPOINT_REGISTRY as `0x${string}`,
        abi: ENDPOINT_REGISTRY_ABI,
        functionName: 'profiles',
        args: [addr],
      }) as Promise<[string, bigint, bigint, bigint]>,
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

    let curveId: number | null = null;
    if (hasLaunched) {
      const cid = await client.readContract({
        address: AGORA_LAUNCHPAD as `0x${string}`,
        abi: LAUNCHPAD_ABI,
        functionName: 'getAgentCurve',
        args: [addr],
      }) as bigint;
      curveId = Number(cid);
    }

    const agent: ResolvedAgent = {
      address,
      name: sub[2],
      payTo: sub[3],
      tier: Number(sub[0]),
      active: sub[4],
      endpointUrl: profile[0],
      endpoints: (endpoints || []).map((e) => ({
        path: e.path,
        priceAgora: e.priceAgora,
        paymentMode: Number(e.paymentMode),
        active: e.active,
      })),
      curveId,
      hasToken: hasLaunched,
    };

    // Cache by both name and address
    cache.set(key, { agent, ts: Date.now() });
    cache.set(address.toLowerCase(), { agent, ts: Date.now() });

    return agent;
  } catch {
    return null;
  }
}
