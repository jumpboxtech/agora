import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { resolveAgent } from '../../../../../lib/agent-resolver';
import { getSourceByPath, decryptSecrets } from '../../../../../lib/datasource-store';
import { proxyDataSource } from '../../../../../lib/datasource-proxy';
import { x402Server } from '../../../../../lib/x402-server';
import { recordPaymentEvent } from '../../../../../lib/analytics';

export const runtime = 'nodejs';

function extractParams(request: NextRequest): { agentParam: string; sourcePath: string } {
  const parts = request.nextUrl.pathname.split('/');
  const agentIdx = parts.indexOf('agent');
  const dataIdx = parts.indexOf('data');
  return {
    agentParam: agentIdx >= 0 ? parts[agentIdx + 1] : '',
    sourcePath: dataIdx >= 0 ? parts[dataIdx + 1] : '',
  };
}

export async function GET(request: NextRequest) {
  const { agentParam, sourcePath } = extractParams(request);

  if (!agentParam || !sourcePath) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const agent = await resolveAgent(agentParam);
  if (!agent || !agent.active) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const source = await getSourceByPath(agent.address, sourcePath);
  if (!source) {
    return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
  }

  // Wrap handler with x402 using this source's price and agent's payTo
  const gatedHandler = withX402(
    async () => {
      recordPaymentEvent(agent.address, `data/${source.path}`, source.price).catch(() => {});
      const decrypted = decryptSecrets(source);
      const result = await proxyDataSource(decrypted);
      return NextResponse.json(result.data, { status: result.status });
    },
    {
      accepts: {
        scheme: 'exact',
        price: source.price,
        network: 'eip155:8453',
        payTo: agent.payTo,
      },
      description: `Data: ${source.name}`,
    },
    x402Server,
  );

  return gatedHandler(request);
}
