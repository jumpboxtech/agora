import type { Metadata } from 'next';
import Script from 'next/script';
import { Rajdhani, JetBrains_Mono } from 'next/font/google';
import '../app/globals.css';

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-rajdhani',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
  variable: '--font-jetbrains',
});

// Static metadata (non-dynamic fields only — dynamic OG/frame metadata lives in page.tsx)
export const metadata: Metadata = {
  title: 'Agora — x402 Infrastructure Tycoon',
  description:
    'Build autonomous x402 payment infrastructure. Deploy APIs, hire AI agents, stake $AGORA. The game teaches x402 — the token unlocks real infrastructure.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${jetbrains.variable} font-sans`}>
      <head>
        <Script
          src="https://cdn.jsdelivr.net/npm/@farcaster/frame-sdk/dist/index.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="font-rajdhani bg-surface text-white">
        {children}
      </body>
    </html>
  );
}
