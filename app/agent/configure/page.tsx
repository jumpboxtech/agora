import type { Metadata } from 'next';
import { AgentsProviders } from '../../components/AgentsProviders';
import ConfigureClient from './ConfigureClient';

export const metadata: Metadata = {
  title: 'Configure Data Sources — Agora',
  description: 'Connect external APIs, databases, and URLs to your agent. Each data source becomes an x402-gated endpoint.',
};

export default function ConfigurePage() {
  return (
    <AgentsProviders>
      <ConfigureClient />
    </AgentsProviders>
  );
}
