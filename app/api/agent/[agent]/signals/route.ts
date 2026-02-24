import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { resolveAgent } from '../../../../lib/agent-resolver';
import { getAgentSignals } from '../../../../lib/agora-data';
import { x402Server } from '../../../../lib/x402-server';
import { recordPaymentEvent } from '../../../../lib/analytics';

export const runtime = 'nodejs';

function extractAgent(request: NextRequest): string {
  const parts = request.nextUrl.pathname.split('/');
  const agentIdx = parts.indexOf('agent');
  return agentIdx >= 0 ? parts[agentIdx + 1] : '';
}

const handler = async (request: NextRequest): Promise<NextResponse<unknown>> => {
  const agentParam = extractAgent(request);
  const agent = await resolveAgent(agentParam);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const signals = await getAgentSignals(agent.address);
  if (!signals) {
    return NextResponse.json({ error: 'Signals unavailable' }, { status: 500 });
  }

  recordPaymentEvent(agent.address, 'signals', '$0.02').catch(() => {});

  return NextResponse.json({
    agent: agent.name,
    address: agent.address,
    signals: {
      totalTasks: signals.totalTasks,
      totalEarned: signals.totalEarned,
      endpointCount: signals.endpointCount,
      hasToken: signals.hasToken,
      price: signals.price,
      graduationPct: signals.graduationPct,
    },
    tier: agent.tier,
    active: agent.active,
  });
};

export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: 'exact',
      price: '$0.02',
      network: 'eip155:8453',
      payTo: '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4',
    },
    description: 'Agent signals and market metrics',
  },
  x402Server,
);
