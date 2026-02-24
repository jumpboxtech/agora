import { getRedis, analyticsKey } from './redis';

const TTL_DAYS = 90;
const TTL_SECS = TTL_DAYS * 86400;

interface PaymentEvent {
  endpoint: string;
  price: string; // e.g. "$0.02"
  ts: number;
}

/**
 * Record an x402 payment event for an agent (fire-and-forget).
 * Stored as a Redis list per agent per day with 90-day TTL.
 */
export async function recordPaymentEvent(
  agentAddress: string,
  endpoint: string,
  price: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const date = new Date().toISOString().slice(0, 10);
  const key = analyticsKey(agentAddress, date);
  const event: PaymentEvent = { endpoint, price, ts: Date.now() };

  await redis.rpush(key, JSON.stringify(event));
  // Set TTL only if key is new (won't reset existing TTL)
  await redis.expire(key, TTL_SECS);
}

function parsePrice(price: string): number {
  return parseFloat(price.replace('$', '')) || 0;
}

/**
 * Get aggregated analytics for an agent over the last N days.
 */
export async function getAnalyticsSummary(
  agentAddress: string,
  days = 30,
): Promise<{
  totalRequests: number;
  totalRevenue: number;
  byEndpoint: Record<string, { requests: number; revenue: number }>;
  daily: { date: string; requests: number; revenue: number }[];
}> {
  const redis = getRedis();
  if (!redis) {
    return { totalRequests: 0, totalRevenue: 0, byEndpoint: {}, daily: [] };
  }

  const now = new Date();
  const daily: { date: string; requests: number; revenue: number }[] = [];
  const byEndpoint: Record<string, { requests: number; revenue: number }> = {};
  let totalRequests = 0;
  let totalRevenue = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const key = analyticsKey(agentAddress, date);

    try {
      const events = await redis.lrange(key, 0, -1) as string[];
      if (!events || events.length === 0) {
        daily.unshift({ date, requests: 0, revenue: 0 });
        continue;
      }

      let dayRequests = 0;
      let dayRevenue = 0;

      for (const raw of events) {
        const event: PaymentEvent = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const rev = parsePrice(event.price);
        dayRequests++;
        dayRevenue += rev;

        if (!byEndpoint[event.endpoint]) {
          byEndpoint[event.endpoint] = { requests: 0, revenue: 0 };
        }
        byEndpoint[event.endpoint].requests++;
        byEndpoint[event.endpoint].revenue += rev;
      }

      totalRequests += dayRequests;
      totalRevenue += dayRevenue;
      daily.unshift({ date, requests: dayRequests, revenue: Math.round(dayRevenue * 10000) / 10000 });
    } catch {
      daily.unshift({ date, requests: 0, revenue: 0 });
    }
  }

  return { totalRequests, totalRevenue: Math.round(totalRevenue * 10000) / 10000, byEndpoint, daily };
}
