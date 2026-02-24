import { createPublicClient, http, formatEther, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import { AGORA_TOKEN, AGORA_STAKING, DEAD_ADDRESS } from './contracts';

const client = createPublicClient({
  chain: base,
  transport: http(
    process.env.ALCHEMY_RPC_URL ||
    process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ||
    'https://1rpc.io/base'
  ),
});

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

// AGORA_TOKEN deployed at block 42491231 on Base mainnet
const FROM_BLOCK = BigInt((process.env.AGORA_DEPLOY_BLOCK || '42491231').trim());

// Public RPCs limit getLogs range — chunk into manageable windows
const CHUNK_SIZE = BigInt(50_000);

interface TransferLog {
  args: { from?: `0x${string}`; to?: `0x${string}`; value?: bigint };
}

async function getLogsChunked(
  args: { to: `0x${string}` },
): Promise<TransferLog[]> {
  const latest = await client.getBlockNumber();
  const allLogs: TransferLog[] = [];

  for (let from = FROM_BLOCK; from <= latest; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE - BigInt(1) > latest ? latest : from + CHUNK_SIZE - BigInt(1);
    try {
      const logs = await client.getLogs({
        address: AGORA_TOKEN as `0x${string}`,
        event: transferEvent,
        args,
        fromBlock: from,
        toBlock: to,
      });
      allLogs.push(...logs);
    } catch (err) {
      // If chunk is still too large, halve it and retry
      const half = (to - from) / BigInt(2);
      if (half < BigInt(1000)) throw err; // give up if chunk too small
      try {
        const logs1 = await client.getLogs({
          address: AGORA_TOKEN as `0x${string}`,
          event: transferEvent,
          args,
          fromBlock: from,
          toBlock: from + half,
        });
        const logs2 = await client.getLogs({
          address: AGORA_TOKEN as `0x${string}`,
          event: transferEvent,
          args,
          fromBlock: from + half + BigInt(1),
          toBlock: to,
        });
        allLogs.push(...logs1, ...logs2);
      } catch {
        console.error('[leaderboard] chunk retry failed', from.toString(), to.toString());
      }
    }
  }
  return allLogs;
}

function aggregateAndSort(
  logs: TransferLog[],
  limit: number,
): LeaderboardEntry[] {
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

export interface LeaderboardEntry {
  address: string;
  amount: string;
  amountRaw: string;
}

export async function getTopBurners(limit = 20): Promise<LeaderboardEntry[]> {
  const logs = await getLogsChunked({ to: DEAD_ADDRESS as `0x${string}` });
  return aggregateAndSort(logs, limit);
}

export async function getTopStakers(limit = 20): Promise<LeaderboardEntry[]> {
  const logs = await getLogsChunked({ to: AGORA_STAKING as `0x${string}` });
  return aggregateAndSort(logs, limit);
}
