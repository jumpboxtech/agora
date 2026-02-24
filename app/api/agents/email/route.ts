import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { getRedis, agentEmailKey } from '../../../lib/redis';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ email: null });
  }

  const email = await redis.get<string>(agentEmailKey(address));
  if (!email) {
    return NextResponse.json({ email: null });
  }

  // Mask email for privacy
  const [user, domain] = email.split('@');
  const masked = `${user.slice(0, 2)}***@${domain}`;
  return NextResponse.json({ email: masked });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { address, email, signature } = body;

  if (!address || !email || !signature) {
    return NextResponse.json({ error: 'address, email, and signature required' }, { status: 400 });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  // Verify wallet signature
  const message = `Set Agora alert email: ${email}`;
  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
  }

  await redis.set(agentEmailKey(address), email);

  return NextResponse.json({ ok: true });
}
