import { encodeAbiParameters, keccak256, toHex } from 'viem';

// ─── Save Data Encoding ─────────────────────────────────────────────────────
// Encodes game state into calldata for a 0-value self-transfer on Base.
// No contract needed — the hash lives immutably in tx calldata.
//
// v1: 0xFAC10001 — fid, tier, processed, earnedCents, questHash
// v2: 0xAGRA0002 — adds apisDeployed, agentsHired, agoraEarned, agoraStaked, agoraBurned, burnBoosts

const MAGIC_V2 = '0xa6a40002';

export interface SavePayload {
  fid: number;
  tier: number;
  totalProcessed: number;
  totalEarned: number;
  completedQuests: string[];
  // v2 fields
  apisDeployed: number;    // count of active APIs
  agentsHired: number;     // count of active agents
  agoraEarned: number;     // lifetime $AGORA earned
  agoraStaked: number;     // currently staked $AGORA
  agoraBurned: number;     // total $AGORA burned
  burnBoosts: string[];    // purchased burn boost IDs
}

export function encodeSaveData(payload: SavePayload): `0x${string}` {
  const questHash = keccak256(
    toHex(payload.completedQuests.sort().join(',') || 'none'),
  );

  const boostHash = keccak256(
    toHex(payload.burnBoosts.sort().join(',') || 'none'),
  );

  const encoded = encodeAbiParameters(
    [
      { name: 'fid', type: 'uint32' },
      { name: 'tier', type: 'uint8' },
      { name: 'processed', type: 'uint64' },
      { name: 'earnedCents', type: 'uint64' },
      { name: 'questHash', type: 'bytes32' },
      { name: 'apisDeployed', type: 'uint8' },
      { name: 'agentsHired', type: 'uint8' },
      { name: 'agoraEarned', type: 'uint64' },
      { name: 'agoraStaked', type: 'uint64' },
      { name: 'agoraBurned', type: 'uint64' },
      { name: 'boostHash', type: 'bytes32' },
    ],
    [
      payload.fid,
      payload.tier,
      BigInt(Math.floor(payload.totalProcessed)),
      BigInt(Math.floor(payload.totalEarned * 100)),
      questHash,
      payload.apisDeployed,
      payload.agentsHired,
      BigInt(Math.floor(payload.agoraEarned)),
      BigInt(Math.floor(payload.agoraStaked)),
      BigInt(Math.floor(payload.agoraBurned)),
      boostHash,
    ],
  );

  return `${MAGIC_V2}${encoded.slice(2)}` as `0x${string}`;
}

// ─── Save Queue ──────────────────────────────────────────────────────────────

export type SaveItem =
  | { type: 'quest'; questId: string; reward: number }
  | { type: 'tier'; tier: number; name: string }
  | { type: 'checkpoint' };

export function formatSaveItem(item: SaveItem): string {
  switch (item.type) {
    case 'quest':
      return `Quest: ${item.questId}`;
    case 'tier':
      return `Tier: ${item.name}`;
    case 'checkpoint':
      return 'Checkpoint';
  }
}

// ─── Status ──────────────────────────────────────────────────────────────────

export const SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function basescanTxUrl(hash: string): string {
  return `https://basescan.org/tx/${hash}`;
}
