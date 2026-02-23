'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Providers } from './Providers';
import LandingPage from './LandingPage';

const Demo = dynamic(() => import('./Demo'), {
  ssr: false,
});

export default function ClientPage() {
  const [env, setEnv] = useState<'loading' | 'miniapp' | 'browser'>('loading');

  useEffect(() => {
    // The Farcaster CDN script sets window.frame.sdk in ALL browsers,
    // not just Warpcast. The real signal is whether sdk.context resolves
    // with a valid user — that only happens inside the Warpcast webview.
    let cancelled = false;

    async function detect() {
      const sdk = window.frame?.sdk;
      if (!sdk) {
        // CDN script hasn't loaded or doesn't exist
        if (!cancelled) setEnv('browser');
        return;
      }

      try {
        // Race context resolution against a timeout.
        // Inside Warpcast this resolves instantly; in a browser it hangs.
        const ctx = await Promise.race([
          sdk.context,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
        ]);
        if (!cancelled) setEnv(ctx ? 'miniapp' : 'browser');
      } catch {
        if (!cancelled) setEnv('browser');
      }
    }

    detect();
    return () => { cancelled = true; };
  }, []);

  if (env === 'loading') {
    return (
      <div className="h-[100dvh] w-full bg-surface flex items-center justify-center">
        <div className="text-accent/40 text-[10px] font-mono tracking-[0.3em] animate-pulse">INITIALIZING</div>
      </div>
    );
  }

  if (env === 'browser') {
    return <LandingPage />;
  }

  return (
    <Providers>
      <main className="h-[100dvh] w-full overflow-hidden">
        <Demo />
      </main>
    </Providers>
  );
}
