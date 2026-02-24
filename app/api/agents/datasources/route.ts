import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { AGORA_AGENT_SUB, AGENT_SUB_ABI } from '../../../lib/contracts';
import { listSources, createSource } from '../../../lib/datasource-store';

export const runtime = 'nodejs';

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://1rpc.io/base'),
});

async function verifySubscription(address: string): Promise<boolean> {
  try {
    return (await client.readContract({
      address: AGORA_AGENT_SUB as `0x${string}`,
      abi: AGENT_SUB_ABI,
      functionName: 'isActive',
      args: [address as `0x${string}`],
    })) as boolean;
  } catch {
    return false;
  }
}

// GET: List data sources for an agent
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'address param required' }, { status: 400 });
  }

  const sources = await listSources(address);
  return NextResponse.json({ sources });
}

// POST: Create a new data source
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, type, name, path, price, url, headers, dbConnectionString, dbQuery, dbType } = body;

    if (!address || !type || !name || !path || !price) {
      return NextResponse.json({ error: 'address, type, name, path, and price required' }, { status: 400 });
    }

    if (!['api', 'url', 'db'].includes(type)) {
      return NextResponse.json({ error: 'type must be api, url, or db' }, { status: 400 });
    }

    if (type === 'db' && (!dbConnectionString || !dbQuery || !dbType)) {
      return NextResponse.json({ error: 'db type requires dbConnectionString, dbQuery, and dbType' }, { status: 400 });
    }

    if ((type === 'api' || type === 'url') && !url) {
      return NextResponse.json({ error: `${type} type requires url` }, { status: 400 });
    }

    const isActive = await verifySubscription(address);
    if (!isActive) {
      return NextResponse.json({ error: 'Agent must have active subscription' }, { status: 403 });
    }

    const source = await createSource(address, {
      type, name, path, price, url, headers, dbConnectionString, dbQuery, dbType,
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    const status = message.includes('Path already') || message.includes('Maximum') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
