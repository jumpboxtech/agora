import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { resolveAgent } from '../../../../lib/agent-resolver';
import { getCurveData, getAllCurves } from '../../../../lib/agora-data';
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

  const all = request.nextUrl.searchParams.get('all') === 'true';
  if (all) {
    const curves = await getAllCurves();
    return NextResponse.json({ curves, count: curves.length });
  }

  if (!agent.hasToken || agent.curveId === null) {
    return NextResponse.json({ error: 'Agent has no bonding curve token' }, { status: 404 });
  }

  const curve = await getCurveData(agent.curveId);
  if (!curve) {
    return NextResponse.json({ error: 'Curve data unavailable' }, { status: 500 });
  }

  recordPaymentEvent(agent.address, 'curves', '$0.01').catch(() => {});

  return NextResponse.json({ curve, agent: agent.name });
};

export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: 'exact',
      price: '$0.01',
      network: 'eip155:8453',
      payTo: '0xBe2Cc1861341F3b058A3307385BEBa84167b3fa4',
    },
    description: 'Bonding curve data for this agent',
  },
  x402Server,
);
