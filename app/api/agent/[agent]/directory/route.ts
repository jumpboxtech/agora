import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { getRegisteredAgents } from '../../../../lib/agora-data';
import { x402Server } from '../../../../lib/x402-server';
import { recordPaymentEvent } from '../../../../lib/analytics';

export const runtime = 'nodejs';

const handler = async (
  request: NextRequest,
): Promise<NextResponse<unknown>> => {
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset') || '0'));
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || '20')));

  const agents = await getRegisteredAgents(offset, limit);

  recordPaymentEvent('protocol', 'directory', '$0.01').catch(() => {});

  return NextResponse.json({
    agents,
    count: agents.length,
    offset,
    limit,
  });
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
    description: 'Agent directory listing with stats',
  },
  x402Server,
);
