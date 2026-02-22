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

const frameMetadata = {
  version: 'next',
  imageUrl: 'https://facilitator.jumpbox.tech/images/frame-preview.png',
  button: {
    title: 'Play Facilitator',
    action: {
      type: 'launch_frame',
      name: 'Facilitator',
      url: 'https://facilitator.jumpbox.tech',
      splashImageUrl: 'https://facilitator.jumpbox.tech/images/splash.png',
      splashBackgroundColor: '#0a0a12',
    },
  },
};

export const metadata: Metadata = {
  title: 'Facilitator — x402 Payment Verification Game',
  description:
    'You are the x402 facilitator. Verify payment signatures, catch malformed requests, settle USDC on Base. How fast can you process?',
  other: {
    'fc:frame': JSON.stringify(frameMetadata),
    'og:image': frameMetadata.imageUrl,
    'fc:frame:image': frameMetadata.imageUrl,
    'fc:frame:button:1': frameMetadata.button.title,
    'fc:frame:post_url': frameMetadata.button.action.url,
  },
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
      <body className="font-rajdhani bg-surface text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
