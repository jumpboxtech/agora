import { createPublicClient, http, formatEther, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import { AGORA_TOKEN, AGORA_STAKING, DEAD_ADDRESS } from './contracts';

const client = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || 'https://mainnet.base.org'),
});

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

// Set to deployment block to limit log scan range
const FROM_BLOCK = BigInt(process.env.AGORA_DEPLOY_BLOCK || '0');

export interface LeaderboardEntry {
  address: string;
  amount: string;
  amountRaw: string;
}

export async function getTopBurners(limit = 20): Promise<LeaderboardEntry[]> {
  const logs = await client.getLogs({
    address: AGORA_TOKEN as `0x${string}`,
    event: transferEvent,
    args: { to: DEAD_ADDRESS as `0x${string}` },
    fromBlock: FROM_BLOCK,
    toBlock: 'latest',
  });

  const totals = new Map<string, bigint>();
  for (const log of logs) {
    const from = log.args.from!;
    const value = log.args.value!;
    totals.set(from, (totals.get(from) || BigInt(0)) + value);
  }

  return [...totals.entries()]
    .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
    .slice(0, limit)
    .map(([addr, amt]) => ({
      address: addr,
      amount: formatEther(amt),
      amountRaw: amt.toString(),
    }));
}

export async function getTopStakers(limit = 20): Promise<LeaderboardEntry[]> {
  const logs = await client.getLogs({
    address: AGORA_TOKEN as `0x${string}`,
    event: transferEvent,
    args: { to: AGORA_STAKING as `0x${string}` },
    fromBlock: FROM_BLOCK,
    toBlock: 'latest',
  });

  const totals = new Map<string, bigint>();
  for (const log of logs) {
    const from = log.args.from!;
    const value = log.args.value!;
    totals.set(from, (totals.get(from) || BigInt(0)) + value);
  }

  return [...totals.entries()]
    .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
    .slice(0, limit)
    .map(([addr, amt]) => ({
      address: addr,
      amount: formatEther(amt),
      amountRaw: amt.toString(),
    }));
}
