import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// Keys
export const questKey = (fid: number) => `agora:quests:${fid}`;
export const stateKey = (fid: number) => `agora:state:${fid}`;
export const leaderboardKey = () => `agora:leaderboard:all`;

// Rewards V2 keys
export const rewardsCooldownKey = (fid: number) => `agora:cooldown:${fid}`;
export const rewardsDailyKey = (fid: number, date: string) => `agora:claims:${fid}:${date}`;
export const rewardsLifetimeKey = (fid: number) => `agora:lifetime:${fid}`;

// Data source keys
export const datasourceKey = (addr: string) => `agent:${addr.toLowerCase()}:datasources`;

// Analytics keys
export const analyticsKey = (addr: string, date: string) => `analytics:events:${addr.toLowerCase()}:${date}`;

// Directory keys
export const directoryKey = () => `agora:directory:all`;

// Health monitoring keys
export const healthKey = (addr: string) => `agent:${addr.toLowerCase()}:health`;
export const healthAlertKey = (addr: string, path: string) => `agent:${addr.toLowerCase()}:health:alert:${path}`;
export const agentEmailKey = (addr: string) => `agent:${addr.toLowerCase()}:email`;
