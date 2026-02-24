import { NextRequest, NextResponse } from 'next/server';
import { getAgentHealth } from '../../../lib/health';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }

  const checks = await getAgentHealth(address);

  return NextResponse.json({
    checks,
    updatedAt: checks.length > 0 ? checks[0].lastChecked : null,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60' },
  });
}
