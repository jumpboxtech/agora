import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { AGORA_AGENT_SUB, AGENT_SUB_ABI } from '../../../../lib/contracts';
import { updateSource, deleteSource } from '../../../../lib/datasource-store';

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

function extractId(request: NextRequest): string {
  const parts = request.nextUrl.pathname.split('/');
  return parts[parts.length - 1];
}

// PUT: Update a data source
export async function PUT(request: NextRequest) {
  try {
    const sourceId = extractId(request);
    const body = await request.json();
    const { address, ...patch } = body;

    if (!address) {
      return NextResponse.json({ error: 'address required' }, { status: 400 });
    }

    const isActive = await verifySubscription(address);
    if (!isActive) {
      return NextResponse.json({ error: 'Agent must have active subscription' }, { status: 403 });
    }

    const updated = await updateSource(address, sourceId, patch);
    if (!updated) {
      return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
    }

    return NextResponse.json({ source: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove a data source
export async function DELETE(request: NextRequest) {
  try {
    const sourceId = extractId(request);
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json({ error: 'address required' }, { status: 400 });
    }

    const isActive = await verifySubscription(address);
    if (!isActive) {
      return NextResponse.json({ error: 'Agent must have active subscription' }, { status: 403 });
    }

    const deleted = await deleteSource(address, sourceId);
    if (!deleted) {
      return NextResponse.json({ error: 'Data source not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
