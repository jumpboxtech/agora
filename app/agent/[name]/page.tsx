import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AgentsProviders } from '../../components/AgentsProviders';
import { AgentProfile } from './AgentProfile';
import { resolveAgent } from '../../lib/agent-resolver';
import { getCurveData } from '../../lib/agora-data';
import { formatEther } from 'viem';

const APP_URL = 'https://agora.jumpbox.tech';

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  return {
    title: `${name} — Agora Agent`,
    description: `View ${name}'s x402 agent profile, bonding curve, and API endpoints on Agora.`,
    openGraph: {
      title: `${name} — Agora Agent`,
      description: `${name}'s x402 agent on Agora. Buy tokens, discover API endpoints, and start building.`,
      url: `${APP_URL}/agent/${name}`,
    },
  };
}

export default async function AgentPage({ params }: Props) {
  const { name } = await params;
  const agent = await resolveAgent(name);
  if (!agent) notFound();

  let curveData = null;
  if (agent.hasToken && agent.curveId !== null) {
    curveData = await getCurveData(agent.curveId);
  }

  // Serialize endpoints (BigInt → string) for client component
  const endpoints = agent.endpoints.map(ep => ({
    path: ep.path,
    priceAgora: formatEther(ep.priceAgora),
    paymentMode: ep.paymentMode,
    active: ep.active,
  }));

  return (
    <AgentsProviders>
      <AgentProfile
        agentName={name}
        agent={{
          address: agent.address,
          tier: agent.tier,
          payTo: agent.payTo,
          active: agent.active,
          endpointUrl: agent.endpointUrl,
          hasToken: agent.hasToken,
          curveId: agent.curveId,
          endpoints,
        }}
        initialCurve={curveData}
      />
    </AgentsProviders>
  );
}
