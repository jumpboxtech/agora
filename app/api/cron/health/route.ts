import { NextResponse } from 'next/server';
import { getRedis, agentEmailKey } from '../../../lib/redis';
import { getRegisteredAgents } from '../../../lib/agora-data';
import { listSources, decryptSecrets } from '../../../lib/datasource-store';
import {
  checkEndpointHealth,
  getAgentHealth,
  setAgentHealth,
  mergeHealthChecks,
  shouldAlert,
  markAlerted,
} from '../../../lib/health';
import { sendHealthAlert } from '../../../lib/email';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FAILURE_THRESHOLD = 4; // 4 × 15min = 1 hour
const MAX_CONCURRENT = 10;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
  }

  try {
    const agents = await getRegisteredAgents(0, 100);
    let totalChecked = 0;
    let totalAlerts = 0;

    for (const agent of agents) {
      const sources = await listSources(agent.address);
      if (sources.length === 0) continue;

      const previous = await getAgentHealth(agent.address);

      // Check sources in batches of MAX_CONCURRENT
      const checks = [];
      for (let i = 0; i < sources.length; i += MAX_CONCURRENT) {
        const batch = sources.slice(i, i + MAX_CONCURRENT);
        const results = await Promise.allSettled(
          batch.map((s) => {
            const decrypted = decryptSecrets(s);
            return checkEndpointHealth(decrypted);
          }),
        );
        for (const r of results) {
          if (r.status === 'fulfilled') checks.push(r.value);
        }
      }

      totalChecked += checks.length;

      // Merge with previous state for consecutive failure tracking
      const merged = mergeHealthChecks(previous, checks);
      await setAgentHealth(agent.address, merged);

      // Check for alertable failures
      const alertable = merged.filter((c) => c.consecutiveFailures >= FAILURE_THRESHOLD);
      if (alertable.length > 0) {
        const email = await redis.get<string>(agentEmailKey(agent.address));
        if (email) {
          // Filter to only newly alertable (not already alerted in last 6h)
          const toAlert = [];
          for (const check of alertable) {
            if (await shouldAlert(agent.address, check.path)) {
              toAlert.push(check);
            }
          }

          if (toAlert.length > 0) {
            const sent = await sendHealthAlert(email, agent.name || agent.address, toAlert);
            if (sent) {
              for (const check of toAlert) {
                await markAlerted(agent.address, check.path);
              }
              totalAlerts++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      agents: agents.length,
      checked: totalChecked,
      alerts: totalAlerts,
    });
  } catch (error) {
    console.error('[cron/health]', error);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
