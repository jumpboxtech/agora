import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { registerAgentName, isNameAvailable } from '../../../lib/agent-resolver';
import { AGORA_AGENT_SUB, AGENT_SUB_ABI } from '../../../lib/contracts';

export const runtime = 'nodejs';

const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

const NAME_REGEX = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;
const RESERVED = new Set(['www', 'agora', 'api', 'admin', 'app', 'docs', 'stats']);

const VERCEL_PROJECT_ID = 'prj_aoMWVnUhQnsziN8UcjMQBCtDeHWj';
const VERCEL_TEAM_ID = 'team_WqgS8H1sEQmvFmxLXeZcYC3J';

/** Register subdomain with Vercel so it auto-issues an SSL cert */
async function addVercelDomain(subdomain: string): Promise<boolean> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.warn('[register-name] VERCEL_TOKEN not set, skipping domain registration');
    return false;
  }

  const domain = `${subdomain}.agora.jumpbox.tech`;
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains?teamId=${VERCEL_TEAM_ID}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    },
  );

  if (res.ok) {
    console.log(`[register-name] Domain ${domain} added to Vercel`);
    return true;
  }

  const body = await res.json().catch(() => ({}));
  // Domain already exists on this project — that's fine
  if ((body as { error?: { code?: string } })?.error?.code === 'domain_already_in_use') {
    console.log(`[register-name] Domain ${domain} already registered`);
    return true;
  }

  console.error(`[register-name] Vercel domain add failed:`, res.status, body);
  return false;
}

// POST: Register agent name for subdomain
export async function POST(request: NextRequest) {
  try {
    const { name, address } = await request.json();

    if (!name || !address) {
      return NextResponse.json({ error: 'name and address required' }, { status: 400 });
    }

    const normalized = name.toLowerCase().trim();

    // Validate name format
    if (!NAME_REGEX.test(normalized)) {
      return NextResponse.json(
        { error: 'Name must be 3-20 chars, alphanumeric + hyphens, start/end with alphanumeric' },
        { status: 400 },
      );
    }

    if (RESERVED.has(normalized)) {
      return NextResponse.json({ error: 'Name is reserved' }, { status: 400 });
    }

    // Verify agent has active subscription on-chain
    const isActive = await client.readContract({
      address: AGORA_AGENT_SUB as `0x${string}`,
      abi: AGENT_SUB_ABI,
      functionName: 'isActive',
      args: [address as `0x${string}`],
    }) as boolean;

    if (!isActive) {
      return NextResponse.json({ error: 'Agent must have active subscription' }, { status: 403 });
    }

    // Register in KV
    const success = await registerAgentName(normalized, address);
    if (!success) {
      return NextResponse.json({ error: 'Name already taken' }, { status: 409 });
    }

    // Register subdomain with Vercel for SSL cert issuance
    const domainAdded = await addVercelDomain(normalized);

    return NextResponse.json({
      success: true,
      name: normalized,
      subdomain: `https://${normalized}.agora.jumpbox.tech`,
      sslPending: !domainAdded,
    });
  } catch (err) {
    console.error('[register-name] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET: Check name availability
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  if (!name) {
    return NextResponse.json({ error: 'name param required' }, { status: 400 });
  }

  const normalized = name.toLowerCase().trim();

  if (!NAME_REGEX.test(normalized) || RESERVED.has(normalized)) {
    return NextResponse.json({ available: false, reason: 'Invalid or reserved name' });
  }

  const available = await isNameAvailable(normalized);
  return NextResponse.json({ available, name: normalized });
}
