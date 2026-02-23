import type { Metadata } from 'next';
import { Providers } from '../components/Providers';
import StatsClient from './StatsClient';

const APP_URL = 'https://agora.jumpbox.tech';

export const metadata: Metadata = {
  title: 'Agora Stats — Protocol Dashboard',
  description: '$AGORA token stats, staking leaderboard, burn metrics, and reward distribution on Base.',
  openGraph: {
    title: 'Agora Stats — Protocol Dashboard',
    description: '$AGORA on-chain metrics, burn leaderboard, and staking data.',
    url: `${APP_URL}/stats`,
    images: [`${APP_URL}/api/og/stats`],
  },
};

export default function StatsPage() {
  return (
    <Providers>
      <StatsClient />
    </Providers>
  );
}
