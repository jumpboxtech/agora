'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─── Theme ──────────────────────────────────────────────────────────────────

const COLORS = {
  accent: '#00ff88',
  danger: '#ff3366',
  warn: '#ffaa00',
  info: '#38bdf8',
  purple: '#a855f7',
  muted: '#6b6b80',
};

// ─── Data ───────────────────────────────────────────────────────────────────

const CONTRACTS = [
  { name: '$AGORA Token', address: '0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131', role: 'ERC-20 token' },
  { name: 'Staking', address: '0x2948e4CC6F368DFC34990F90B2cc7750E68Ef3B3', role: 'Stake $AGORA for revenue boosts' },
  { name: 'Agent Subscriptions', address: '0x4FF5385a533FF88fc848946cB13974F44201896b', role: 'Agent service subscriptions + burns' },
  { name: 'Rewards', address: '0x0fdaB9D5e76E6b6Ba882044900c1976Dd7648c4b', role: 'Claim reward tickets' },
  { name: 'Dead Address', address: '0x000000000000000000000000000000000000dEaD', role: 'Burn destination' },
];

const STAKING_TIERS = [
  { threshold: '10M', bonus: '+5%', color: COLORS.accent },
  { threshold: '100M', bonus: '+15%', color: COLORS.info },
  { threshold: '1B', bonus: '+30%', color: COLORS.purple },
  { threshold: '10B', bonus: '+50%', color: COLORS.warn },
];

const APIS = [
  { name: 'Token Price', icon: '📊', cost: '$100', tier: 0 },
  { name: 'Signal Score', icon: '📡', cost: '$500', tier: 1 },
  { name: 'Agent Registry', icon: '🤖', cost: '$2K', tier: 2 },
  { name: 'Payment Router', icon: '💳', cost: '$10K', tier: 3 },
  { name: 'Curve Scanner', icon: '📈', cost: '$50K', tier: 4 },
  { name: 'AI Orchestrator', icon: '🧠', cost: '$250K', tier: 5 },
];

const AGENTS = [
  { name: 'Builder', icon: '🔨', effect: 'Auto-builds APIs' },
  { name: 'Optimizer', icon: '🔧', effect: 'Auto-buys upgrades' },
  { name: 'Scout', icon: '👁', effect: '+15% API revenue' },
  { name: 'Architect', icon: '📐', effect: '-50% build time' },
];

const TOKENOMICS = [
  { name: 'Staking Rewards', pct: 40, amount: '40B', color: COLORS.info },
  { name: 'Community Rewards', pct: 25, amount: '25B', color: COLORS.accent },
  { name: 'Expansion / Future', pct: 20, amount: '20B', color: COLORS.purple },
  { name: 'Gameplay Rewards', pct: 15, amount: '15B', color: COLORS.warn },
];

const BURN_BOOSTS = [
  { name: '+1% Accuracy', cost: '5K' },
  { name: '+2% Accuracy', cost: '15K' },
  { name: '+5% Bandwidth', cost: '10K' },
  { name: '+10% Bandwidth', cost: '30K' },
  { name: '+3% Revenue', cost: '8K' },
  { name: '+6% Revenue', cost: '25K' },
];

// ─── Components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-[10px] font-mono tracking-[0.3em] text-accent/60">{title}</h2>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-surface-card border border-white/5">
      {children}
    </div>
  );
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-6">
      <Section title="WHAT IS AGORA?">
        <Card>
          <p className="text-sm text-white/70 leading-relaxed">
            Agora is an <span className="text-accent font-bold">x402 Infrastructure Tycoon</span> — an idle game on Farcaster where you build autonomous payment infrastructure. Deploy APIs, hire AI agents, stake $AGORA tokens, and earn simulated USDC. The game teaches how x402 micropayments work while the token unlocks real on-chain infrastructure.
          </p>
        </Card>
      </Section>

      <Section title="HOW TO PLAY">
        <Card>
          <div className="space-y-3 text-[11px] font-mono text-white/50">
            <div className="flex items-start gap-3">
              <span className="text-accent font-bold w-5 flex-shrink-0">01</span>
              <span><span className="text-white/80">Connect your wallet</span> — opens automatically in Warpcast mini app</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-accent font-bold w-5 flex-shrink-0">02</span>
              <span><span className="text-white/80">Deploy APIs</span> — each API generates revenue per request processed</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-accent font-bold w-5 flex-shrink-0">03</span>
              <span><span className="text-white/80">Hire agents</span> — AI workers that auto-build, optimize, and boost revenue</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-accent font-bold w-5 flex-shrink-0">04</span>
              <span><span className="text-white/80">Upgrade infrastructure</span> — scale from VPS to Global tier</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-accent font-bold w-5 flex-shrink-0">05</span>
              <span><span className="text-white/80">Stake $AGORA</span> — on-chain staking for revenue multipliers</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-accent font-bold w-5 flex-shrink-0">06</span>
              <span><span className="text-white/80">Burn to boost</span> — permanently burn tokens for permanent upgrades</span>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="APIS">
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {APIS.map(api => (
              <div key={api.name} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className="text-base">{api.icon}</span>
                <div>
                  <div className="text-[10px] font-mono text-white/70">{api.name}</div>
                  <div className="text-[8px] font-mono text-white/25">{api.cost} · Tier {api.tier}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="AI AGENTS">
        <Card>
          <div className="grid grid-cols-2 gap-2">
            {AGENTS.map(agent => (
              <div key={agent.name} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className="text-base">{agent.icon}</span>
                <div>
                  <div className="text-[10px] font-mono text-white/70">{agent.name}</div>
                  <div className="text-[8px] font-mono text-white/25">{agent.effect}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="TOKENOMICS — 100B $AGORA">
        <Card>
          <div className="text-[9px] font-mono text-white/25 mb-3">90B tokens drip at ~1B / day for 90 days</div>
          {/* Allocation bar */}
          <div className="h-3 rounded-full bg-white/5 overflow-hidden flex mb-3">
            {TOKENOMICS.map(t => (
              <div key={t.name} className="h-full" style={{ width: `${t.pct}%`, background: t.color, opacity: 0.8 }} />
            ))}
          </div>
          <div className="space-y-1.5">
            {TOKENOMICS.map(t => (
              <div key={t.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <span className="flex-1 text-[10px] font-mono text-white/50">{t.name}</span>
                <span className="text-[10px] font-mono font-bold" style={{ color: t.color }}>{t.amount} ({t.pct}%)</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ─── Technical Tab ──────────────────────────────────────────────────────────

function TechnicalTab() {
  return (
    <div className="space-y-6">
      <Section title="SMART CONTRACTS — BASE MAINNET">
        <Card>
          <div className="space-y-2">
            {CONTRACTS.map(c => (
              <div key={c.address} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-2.5 py-2 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className="text-[10px] font-mono font-bold text-white/70 w-36 flex-shrink-0">{c.name}</span>
                <a
                  href={`https://basescan.org/address/${c.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-mono text-accent/60 hover:text-accent transition-colors break-all"
                >
                  {truncAddr(c.address)}
                </a>
                <span className="text-[8px] font-mono text-white/20 sm:ml-auto">{c.role}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="STAKING TIERS">
        <Card>
          <div className="space-y-1.5">
            {STAKING_TIERS.map(tier => (
              <div key={tier.threshold} className="flex items-center gap-3 px-2.5 py-2 rounded-lg border border-white/5">
                <span className="text-[10px] font-mono font-bold w-12" style={{ color: tier.color }}>{tier.threshold}</span>
                <div className="flex-1 h-1 rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: tier.bonus.replace('+', '').replace('%', '') + '%', background: tier.color, opacity: 0.6 }} />
                </div>
                <span className="text-[10px] font-mono font-bold" style={{ color: tier.color }}>{tier.bonus} revenue</span>
              </div>
            ))}
          </div>
          <div className="text-[8px] font-mono text-white/15 mt-2">30-second unstaking cooldown · 1% burn on reward claims</div>
        </Card>
      </Section>

      <Section title="BURN-TO-BOOST UPGRADES">
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BURN_BOOSTS.map(b => (
              <div key={b.name} className="flex items-center justify-between px-2.5 py-2 rounded-lg border border-danger/10 bg-danger/[0.03]">
                <span className="text-[10px] font-mono text-white/60">{b.name}</span>
                <span className="text-[9px] font-mono font-bold text-danger">{b.cost}</span>
              </div>
            ))}
          </div>
          <div className="text-[8px] font-mono text-white/15 mt-2">Burns are permanent transfers to 0x...dEaD — tokens removed from circulation forever</div>
        </Card>
      </Section>

      <Section title="API ROUTES">
        <Card>
          <div className="space-y-1">
            {[
              { path: '/api/og', desc: 'Dynamic OG image generation (player stats)' },
              { path: '/api/og/stats', desc: 'Stats page OG image' },
              { path: '/api/og/docs', desc: 'Docs page OG image' },
              { path: '/api/leaderboard', desc: 'Top stakers + burners (cached 5 min)' },
              { path: '/api/quests', desc: 'Quest data + claim rewards' },
              { path: '/api/rewards', desc: 'On-chain reward tickets' },
              { path: '/api/state', desc: 'Game state sync' },
            ].map(route => (
              <div key={route.path} className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg border border-white/5">
                <code className="text-[9px] font-mono text-accent/70 w-32 flex-shrink-0">{route.path}</code>
                <span className="text-[8px] font-mono text-white/25">{route.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="INFRASTRUCTURE TIERS">
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['VPS', 'CLUSTER', 'DATACENTER', 'REGIONAL', 'NATIONAL', 'CONTINENTAL', 'GLOBAL'].map((name, i) => {
              const colors = ['#4ade80', '#22d3ee', '#3b82f6', '#a78bfa', '#f472b6', '#fb923c', '#facc15'];
              return (
                <div key={name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/5">
                  <div className="w-2 h-2 rounded-full" style={{ background: colors[i] }} />
                  <span className="text-[9px] font-mono" style={{ color: colors[i] }}>T{i} — {name}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DocsClient() {
  const [tab, setTab] = useState<'overview' | 'technical'>('overview');

  return (
    <div className="min-h-[100dvh] w-full bg-surface relative overflow-auto">
      <div className="scanline" />
      <div className="noise" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-[9px] font-mono tracking-[0.3em] text-accent/60 mb-1">$AGORA ON BASE</div>
          <h1 className="text-2xl font-bold tracking-tight text-white">DOCUMENTATION</h1>
          <p className="text-[11px] text-white/30 mt-1">Game mechanics, tokenomics, and smart contracts</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('overview')}
            className={`px-4 py-1.5 rounded-lg text-[9px] font-mono tracking-wider transition-all ${
              tab === 'overview' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-white/25 border border-white/5 hover:text-white/40'
            }`}
          >
            OVERVIEW
          </button>
          <button
            onClick={() => setTab('technical')}
            className={`px-4 py-1.5 rounded-lg text-[9px] font-mono tracking-wider transition-all ${
              tab === 'technical' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-white/25 border border-white/5 hover:text-white/40'
            }`}
          >
            TECHNICAL
          </button>
        </div>

        {/* Content */}
        {tab === 'overview' ? <OverviewTab /> : <TechnicalTab />}

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 py-4">
          <Link href="/" className="text-[10px] font-mono text-accent/50 hover:text-accent transition-colors">
            PLAY AGORA
          </Link>
          <span className="text-white/10">·</span>
          <Link href="/stats" className="text-[10px] font-mono text-accent/50 hover:text-accent transition-colors">
            PROTOCOL STATS
          </Link>
          <span className="text-white/10">·</span>
          <a href="https://github.com/jumpboxtech/agora" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-accent/50 hover:text-accent transition-colors">
            GITHUB
          </a>
        </div>
      </div>
    </div>
  );
}
