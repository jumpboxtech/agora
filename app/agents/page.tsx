import type { Metadata } from 'next';
import { Providers } from '../components/Providers';
import AgentsClient from './AgentsClient';

const APP_URL = 'https://agora.jumpbox.tech';

export const metadata: Metadata = {
  title: 'Agora Agent Launchpad — Deploy x402 Agents',
  description: 'Launch your own x402 agent on Agora infrastructure. Subscribe with $AGORA, get a Vercel deployment, and start earning.',
  openGraph: {
    title: 'Agora Agent Launchpad — Deploy x402 Agents',
    description: 'Subscribe with $AGORA to deploy your own x402 agent on Agora shared infrastructure.',
    url: `${APP_URL}/agents`,
    images: [`${APP_URL}/api/og/docs`],
  },
};

export default function AgentsPage() {
  return (
    <Providers>
      <AgentsClient />
    </Providers>
  );
}
