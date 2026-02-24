import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Only intercept agent subdomains: *.agora.jumpbox.tech
  const match = hostname.match(/^([a-z0-9-]+)\.agora\.jumpbox\.tech$/i);
  if (!match) return NextResponse.next();

  const agentName = match[1].toLowerCase();

  // Skip www and agora itself
  if (agentName === 'www' || agentName === 'agora') return NextResponse.next();

  // Set agent name header for downstream routes
  const headers = new Headers(request.headers);
  headers.set('x-agent-name', agentName);

  const pathname = url.pathname;

  // Rewrite API paths: /api/v1/* → /api/agent/[agent]/*
  if (pathname.startsWith('/api/v1/')) {
    const apiPath = pathname.replace('/api/v1/', '');
    url.pathname = `/api/agent/${agentName}/${apiPath}`;
    return NextResponse.rewrite(url, { headers });
  }

  // Root → agent info
  if (pathname === '/' || pathname === '') {
    url.pathname = `/api/agent/${agentName}/info`;
    return NextResponse.rewrite(url, { headers });
  }

  // All other paths → pass through with agent header
  return NextResponse.next({ headers });
}

export const config = {
  matcher: ['/((?!_next|favicon\\.ico|images|og).*)'],
};
