import { NextRequest, NextResponse } from 'next/server';
import { getSource, decryptSecrets } from '../../../../../lib/datasource-store';
import { proxyDataSource } from '../../../../../lib/datasource-proxy';

export const runtime = 'nodejs';

function extractId(request: NextRequest): string {
  const parts = request.nextUrl.pathname.split('/');
  const testIdx = parts.indexOf('test');
  return testIdx > 0 ? parts[testIdx - 1] : '';
}

// POST: Test a data source connection
export async function POST(request: NextRequest) {
  try {
    const sourceId = extractId(request);
    const body = await request.json();
    const { address } = body;

    if (!address || !sourceId) {
      return NextResponse.json({ error: 'address required' }, { status: 400 });
    }

    const source = await getSource(address, sourceId);
    if (!source) {
      return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
    }

    const decrypted = decryptSecrets(source);
    const result = await proxyDataSource(decrypted);

    // Truncate preview for test
    let preview = result.data;
    if (typeof preview === 'object' && preview !== null && 'rows' in (preview as Record<string, unknown>)) {
      const rows = (preview as { rows: unknown[] }).rows;
      preview = { rows: rows.slice(0, 5), count: rows.length, preview: true };
    }

    return NextResponse.json({ status: result.status, preview });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Test failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
