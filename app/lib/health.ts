import { getRedis, healthKey, healthAlertKey } from './redis';
import type { DecryptedDataSource } from './datasource-store';

export interface HealthCheck {
  path: string;
  name: string;
  type: string;
  status: 'up' | 'down' | 'unknown';
  latencyMs: number;
  lastChecked: number;
  consecutiveFailures: number;
  lastSuccess: number | null;
  lastError: string | null;
}

const CHECK_TIMEOUT = 3000;

/**
 * Perform a lightweight health check on a data source.
 */
export async function checkEndpointHealth(source: DecryptedDataSource): Promise<HealthCheck> {
  const start = Date.now();
  const base: Omit<HealthCheck, 'status' | 'latencyMs' | 'lastError'> = {
    path: source.path,
    name: source.name,
    type: source.type,
    lastChecked: Date.now(),
    consecutiveFailures: 0,
    lastSuccess: null,
  };

  try {
    if (source.type === 'db') {
      // For DB sources, just verify connection (don't execute query)
      if (source.dbType === 'postgres') {
        const { Client } = await import('pg');
        const client = new Client({
          connectionString: source.dbConnectionString,
          connectionTimeoutMillis: CHECK_TIMEOUT,
        });
        await client.connect();
        await client.query('SELECT 1');
        await client.end().catch(() => {});
      } else {
        const mysql = await import('mysql2/promise');
        const conn = await mysql.createConnection({
          uri: source.dbConnectionString,
          connectTimeout: CHECK_TIMEOUT,
        });
        await conn.execute('SELECT 1');
        await conn.end().catch(() => {});
      }
    } else {
      // URL or API: just fetch with timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT);
      const headers: Record<string, string> = {};
      if (source.type === 'api' && source.headers) {
        Object.assign(headers, source.headers);
      }
      const res = await fetch(source.url!, { signal: controller.signal, headers });
      clearTimeout(timer);
      if (!res.ok && res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
    }

    return {
      ...base,
      status: 'up',
      latencyMs: Date.now() - start,
      lastError: null,
      lastSuccess: Date.now(),
    };
  } catch (err) {
    return {
      ...base,
      status: 'down',
      latencyMs: Date.now() - start,
      lastError: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get cached health checks for an agent from Redis.
 */
export async function getAgentHealth(address: string): Promise<HealthCheck[]> {
  const redis = getRedis();
  if (!redis) return [];

  try {
    const raw = await redis.get<string>(healthKey(address));
    if (!raw) return [];
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as HealthCheck[]);
  } catch {
    return [];
  }
}

/**
 * Store health checks in Redis with 1h TTL.
 */
export async function setAgentHealth(address: string, checks: HealthCheck[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(healthKey(address), JSON.stringify(checks), { ex: 3600 });
}

/**
 * Merge new check results with previous state (preserving consecutiveFailures and lastSuccess).
 */
export function mergeHealthChecks(previous: HealthCheck[], current: HealthCheck[]): HealthCheck[] {
  const prevMap = new Map(previous.map((c) => [c.path, c]));

  return current.map((check) => {
    const prev = prevMap.get(check.path);
    if (!prev) return check;

    if (check.status === 'down') {
      check.consecutiveFailures = prev.consecutiveFailures + 1;
      check.lastSuccess = prev.lastSuccess;
    } else {
      check.consecutiveFailures = 0;
      check.lastSuccess = check.lastChecked;
    }
    return check;
  });
}

/**
 * Check if we should send an alert (4+ consecutive failures, no alert in last 6h).
 */
export async function shouldAlert(address: string, path: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const key = healthAlertKey(address, path);
  const lastAlert = await redis.get<number>(key);
  if (lastAlert && Date.now() - lastAlert < 6 * 3600 * 1000) {
    return false; // Already alerted within 6h
  }
  return true;
}

/**
 * Mark that an alert was sent.
 */
export async function markAlerted(address: string, path: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(healthAlertKey(address, path), Date.now(), { ex: 6 * 3600 });
}
