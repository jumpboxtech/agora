'use client';

import dynamic from 'next/dynamic';

const Demo = dynamic(() => import('./Demo'), {
  ssr: false,
});

export default function ClientPage() {
  return (
    <main className="h-[100dvh] w-full overflow-hidden">
      <Demo />
    </main>
  );
}