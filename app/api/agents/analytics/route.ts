import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsSummary } from '../../../lib/analytics';
import { getAgentSignals } from '../../../lib/agora-data';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  const days = parseInt(request.nextUrl.searchParams.get('days') || '30', 10);

  if (!address || !address.startsWith('0x')) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }

  const clampedDays = Math.min(Math.max(days, 1), 90);

  const [summary, signals] = await Promise.all([
    getAnalyticsSummary(address, clampedDays),
    getAgentSignals(address).catch(() => null),
  ]);

  return NextResponse.json({
    ...summary,
    onChain: signals
      ? {
          totalTasks: signals.totalTasks,
          totalEarned: signals.totalEarned,
          endpointCount: signals.endpointCount,
        }
      : null,
  }, {
    headers: { 'Cache-Control': 'private, s-maxage=30' },
  });
}
