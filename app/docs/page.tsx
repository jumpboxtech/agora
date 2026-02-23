import type { Metadata } from 'next';
import { Providers } from '../components/Providers';
import DocsClient from './DocsClient';

const APP_URL = 'https://agora.jumpbox.tech';

export const metadata: Metadata = {
  title: 'Agora Docs — Game Mechanics, Tokenomics & Contracts',
  description: 'Everything about Agora: x402 infrastructure tycoon gameplay, $AGORA tokenomics, staking tiers, burn mechanics, and smart contract addresses on Base.',
  openGraph: {
    title: 'Agora Docs — Game Mechanics, Tokenomics & Contracts',
    description: 'x402 infrastructure tycoon: game mechanics, $AGORA tokenomics, and Base smart contracts.',
    url: `${APP_URL}/docs`,
    images: [`${APP_URL}/api/og/docs`],
  },
};

export default function DocsPage() {
  return (
    <Providers>
      <DocsClient />
    </Providers>
  );
}
