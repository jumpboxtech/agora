import { NextRequest, NextResponse } from 'next/server';
import { resolveAgent } from '../../../../lib/agent-resolver';
import { formatEther } from 'viem';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string }> },
) {
  const { agent: agentParam } = await params;

  const agent = await resolveAgent(agentParam);
  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found', name: agentParam },
      { status: 404 },
    );
  }

  return NextResponse.json({
    name: agent.name,
    address: agent.address,
    tier: agent.tier,
    active: agent.active,
    endpointUrl: agent.endpointUrl,
    hasToken: agent.hasToken,
    curveId: agent.curveId,
    endpoints: agent.endpoints.map(e => ({
      path: e.path,
      priceAgora: formatEther(e.priceAgora),
      paymentMode: e.paymentMode === 0 ? 'curve' : 'direct',
      active: e.active,
    })),
    availableApis: {
      curves: { path: '/api/v1/curves', price: '$0.01 USDC', description: 'Bonding curve data' },
      signals: { path: '/api/v1/signals', price: '$0.02 USDC', description: 'Agent signals & metrics' },
      directory: { path: '/api/v1/directory', price: '$0.01 USDC', description: 'Agent directory listing' },
    },
    subdomain: `https://${agentParam}.agora.jumpbox.tech`,
  });
}
