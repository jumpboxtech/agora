'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useConnect, useReadContract } from 'wagmi';
import { useAgoraAgentSub, SUB_TIERS } from '../lib/useAgoraAgentSub';
import { useAgoraStaking, formatTokenAmount } from '../lib/useAgoraStaking';
import { AGORA_AGENT_SUB, AGENT_SUB_ABI } from '../lib/contracts';

// ─── Theme ──────────────────────────────────────────────────────────────────

const COLORS = {
  accent: '#00ff88',
  purple: '#a855f7',
  purpleDim: '#7c3aed',
  danger: '#ff3366',
  warn: '#ffaa00',
  info: '#38bdf8',
  muted: '#6b6b80',
};

// ─── Data ───────────────────────────────────────────────────────────────────

const TIER_FEATURES = [
  {
    tier: 1,
    name: 'STARTER',
    infra: ['Vercel deployment', '5 API routes', 'Shared compute', 'Subdomain included'],
  },
  {
    tier: 2,
    name: 'PRO',
    infra: ['Vercel deployment', '25 API routes', 'Priority routing', 'Custom domain ready'],
  },
  {
    tier: 3,
    name: 'ENTERPRISE',
    infra: ['Dedicated deployment', 'Unlimited routes', 'Dedicated compute', 'SLA guarantee'],
  },
];

const TIER_COMPARISON = [
  { feature: 'Monthly cost', values: ['50M $AGORA', '100M $AGORA', '250M $AGORA'] },
  { feature: 'API routes', values: ['5', '25', 'Unlimited'] },
  { feature: 'Requests/sec', values: ['10', '100', '1,000'] },
  { feature: 'Compute', values: ['Shared', 'Priority', 'Dedicated'] },
  { feature: 'Domain', values: ['Subdomain', 'Custom domain', 'Custom domain'] },
  { feature: 'Support', values: ['Community', 'Email', 'Direct'] },
];

const FAQ_ITEMS = [
  {
    q: 'What happens when my subscription expires?',
    a: 'Your agent name is reserved for 7 days after expiry. After that, the name becomes available for others. Renew before expiry to maintain your agent.',
  },
  {
    q: 'Can I change my agent name?',
    a: 'Yes — use the Update Settings button on the My Agent tab. Name changes call the updateAgent contract function. Your old name is released immediately.',
  },
  {
    q: 'How do I upgrade tiers?',
    a: 'Currently you need to let your subscription expire and re-subscribe at a higher tier. Inline upgrades are coming in a future contract version.',
  },
  {
    q: 'What\'s the burn mechanism?',
    a: '50% of every subscription payment is sent to the dead address (0x...dEaD) and permanently removed from circulation. The other 50% goes to the protocol treasury.',
  },
];

// ─── Components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-[10px] font-mono tracking-[0.3em] text-purple-400/60">{title}</h2>
      {children}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 rounded-xl bg-surface-card border border-white/5 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3 rounded-xl bg-surface-card border border-white/5">
      <div className="text-[8px] font-mono tracking-wider mb-1" style={{ color: COLORS.muted }}>{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({ totalActive, totalBurned, onGetStarted }: {
  totalActive: number;
  totalBurned: bigint;
  onGetStarted: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="border-purple-500/20 bg-purple-500/[0.03]">
        <div className="text-center space-y-3">
          <div className="text-[9px] font-mono tracking-[0.3em] text-purple-400/60">AGORA INFRASTRUCTURE</div>
          <h2 className="text-xl font-bold text-white">Agent Launchpad</h2>
          <p className="text-[13px] text-white/50 leading-relaxed max-w-lg mx-auto">
            Graduate from the game. Deploy your own x402 agent on Agora&apos;s shared Vercel infrastructure.
            Subscribe with $AGORA, claim your subdomain, and start earning real revenue.
          </p>
          <button
            onClick={onGetStarted}
            className="px-6 py-2 rounded-lg text-[11px] font-bold bg-purple-500/80 text-white hover:bg-purple-500 active:scale-95 transition-all"
          >
            GET STARTED
          </button>
        </div>
      </Card>

      {/* Network Stats */}
      <Section title="NETWORK">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="ACTIVE AGENTS" value={String(totalActive)} color={COLORS.purple} />
          <StatCard label="$AGORA BURNED" value={formatTokenAmount(totalBurned)} color={COLORS.danger} />
          <StatCard label="UPTIME" value="100%" color={COLORS.accent} />
        </div>
      </Section>

      {/* How it works */}
      <Section title="HOW IT WORKS">
        <Card>
          <div className="space-y-3 text-[11px] font-mono text-white/50">
            {[
              { step: '01', title: 'Play the game', desc: 'build infrastructure, accrue $AGORA' },
              { step: '02', title: 'Subscribe', desc: 'choose a tier and claim your agent name on-chain' },
              { step: '03', title: 'Get deployed', desc: 'Agora provisions your Vercel deployment' },
              { step: '04', title: 'Earn revenue', desc: 'x402 payments flow to your payTo address' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <span className="text-purple-400 font-bold w-5 flex-shrink-0">{s.step}</span>
                <span><span className="text-white/80">{s.title}</span> — {s.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* Agent Directory Placeholder */}
      <Section title="ACTIVE AGENTS">
        <Card>
          <div className="text-center py-6">
            <div className="text-3xl font-bold text-purple-400 mb-2">{totalActive}</div>
            <div className="text-[11px] text-white/30">agents live on Agora infrastructure</div>
            <div className="text-[9px] font-mono text-white/15 mt-3">Full directory coming soon</div>
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ─── Launch Tab ─────────────────────────────────────────────────────────────

function LaunchTab({ isConnected, chainSub, chainStake, onGoToAgent }: {
  isConnected: boolean;
  chainSub: ReturnType<typeof useAgoraAgentSub>;
  chainStake: ReturnType<typeof useAgoraStaking>;
  onGoToAgent: () => void;
}) {
  const { address } = useAccount();
  const [selectedTier, setSelectedTier] = useState(1);
  const [agentName, setAgentName] = useState('');
  const [nameToCheck, setNameToCheck] = useState('');
  const nameCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Name availability check
  const { data: nameAvailable, isLoading: isCheckingName } = useReadContract({
    address: AGORA_AGENT_SUB as `0x${string}`,
    abi: AGENT_SUB_ABI,
    functionName: 'isNameAvailable',
    args: nameToCheck ? [nameToCheck] : undefined,
    query: { enabled: !!nameToCheck && nameToCheck.length >= 1 },
  });

  const validNameFormat = agentName.length >= 1 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(agentName);

  const handleNameChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setAgentName(cleaned);

    if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);

    const isValid = cleaned.length >= 1 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(cleaned);
    if (isValid) {
      nameCheckTimerRef.current = setTimeout(() => setNameToCheck(cleaned), 500);
    } else {
      setNameToCheck('');
    }
  };

  // Already subscribed
  if (chainSub.active) {
    return (
      <div className="space-y-6">
        <Card className="border-purple-500/20 bg-purple-500/[0.03]">
          <div className="text-center space-y-3">
            <div className="text-[9px] font-mono text-accent">ALREADY SUBSCRIBED</div>
            <p className="text-[13px] text-white/50">
              You have an active agent subscription. Manage it from the My Agent tab.
            </p>
            <button
              onClick={onGoToAgent}
              className="px-6 py-2 rounded-lg text-[11px] font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all"
            >
              VIEW MY AGENT
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <Card className="border-purple-500/20 bg-purple-500/[0.03]">
          <div className="text-center space-y-3 py-4">
            <div className="text-lg font-bold text-white/80">Connect Your Wallet</div>
            <p className="text-[13px] text-white/40">
              Connect your Farcaster wallet to subscribe and launch your agent.
            </p>
            <p className="text-[10px] font-mono text-white/20">
              Open this page in Warpcast to connect automatically
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const tierDef = SUB_TIERS.find(t => t.tier === selectedTier);
  const tierCost = tierDef?.cost ?? BigInt(0);
  const needsApprove = chainSub.needsApproval(tierCost);
  const canAfford = chainStake.balance >= tierCost;

  return (
    <div className="space-y-6">
      {/* Step 1 — Choose tier */}
      <Section title="STEP 1 — CHOOSE YOUR TIER">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TIER_FEATURES.map((tf) => {
            const sub = SUB_TIERS.find(s => s.tier === tf.tier);
            const isSelected = selectedTier === tf.tier;
            return (
              <button
                key={tf.tier}
                onClick={() => setSelectedTier(tf.tier)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-purple-500/10 border-purple-500/40 ring-1 ring-purple-500/20'
                    : 'bg-surface-card border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-white/80">{tf.name}</span>
                  {isSelected && <span className="text-[8px] text-accent font-mono">SELECTED</span>}
                </div>
                <div className="text-[13px] font-bold mb-3" style={{ color: COLORS.purple }}>
                  {sub?.label}
                </div>
                <div className="space-y-1">
                  {tf.infra.map(feat => (
                    <div key={feat} className="flex items-center gap-2 text-[10px] text-white/40">
                      <span className="text-purple-400/60">+</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Step 2 — Name your agent */}
      <Section title="STEP 2 — NAME YOUR AGENT">
        <Card>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={agentName}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="my-cool-agent"
                maxLength={63}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[13px] font-mono text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/30 transition-colors"
              />
            </div>

            {/* Availability indicator */}
            {agentName.length > 0 && (
              <div className="flex items-center gap-2">
                {!validNameFormat ? (
                  <span className="text-[10px] font-mono text-warn/70">Invalid format (a-z, 0-9, hyphens only)</span>
                ) : isCheckingName || nameToCheck !== agentName ? (
                  <span className="text-[10px] font-mono text-white/30 animate-pulse">Checking availability...</span>
                ) : nameAvailable ? (
                  <span className="text-[10px] font-mono text-accent">Available</span>
                ) : (
                  <span className="text-[10px] font-mono text-danger">Taken</span>
                )}
              </div>
            )}

            {/* Subdomain preview */}
            {validNameFormat && (
              <div className="text-[11px] font-mono text-purple-300/50">
                {agentName}.agora.jumpbox.tech
              </div>
            )}

            <div className="text-[9px] font-mono text-white/15">
              1-63 characters · lowercase letters, numbers, hyphens · must start and end with letter or number
            </div>
          </div>
        </Card>
      </Section>

      {/* Step 3 — Subscribe */}
      <Section title="STEP 3 — SUBSCRIBE">
        <Card>
          <div className="space-y-3">
            {/* Balance */}
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-white/40">Your balance</span>
              <span className="text-white/60">{formatTokenAmount(chainStake.balance)} $AGORA</span>
            </div>

            {/* Cost */}
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-white/40">Subscription cost</span>
              <span className="text-purple-300">{tierDef?.label} $AGORA</span>
            </div>

            {!canAfford && (
              <div className="text-[10px] font-mono text-warn/70 text-center py-1">
                Insufficient $AGORA balance
              </div>
            )}

            {/* CTA */}
            <button
              onClick={() => {
                if (!address || !validNameFormat) return;
                if (needsApprove) {
                  chainSub.approve(tierCost);
                } else {
                  chainSub.subscribe(selectedTier, agentName, address);
                }
              }}
              disabled={!validNameFormat || !canAfford || chainSub.isPending || (nameAvailable === false)}
              className={`w-full py-3 rounded-lg text-[12px] font-bold transition-all ${
                validNameFormat && canAfford && nameAvailable !== false
                  ? 'bg-purple-500/80 text-white hover:bg-purple-500 active:scale-[0.98]'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              {chainSub.isPending
                ? 'CONFIRMING...'
                : needsApprove
                  ? 'APPROVE $AGORA'
                  : `SUBSCRIBE — ${tierDef?.label}`}
            </button>

            <div className="text-[9px] font-mono text-white/15 text-center">
              50% burned forever &middot; 50% to protocol treasury &middot; 30 days per period
            </div>
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ─── My Agent Tab ───────────────────────────────────────────────────────────

function MyAgentTab({ isConnected, chainSub, onGoToLaunch }: {
  isConnected: boolean;
  chainSub: ReturnType<typeof useAgoraAgentSub>;
  onGoToLaunch: () => void;
}) {
  const { address } = useAccount();
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateName, setUpdateName] = useState('');
  const [updatePayTo, setUpdatePayTo] = useState('');

  if (!isConnected) {
    return (
      <Card className="border-purple-500/20 bg-purple-500/[0.03]">
        <div className="text-center py-4">
          <p className="text-[13px] text-white/40">Connect your wallet to view your agent</p>
        </div>
      </Card>
    );
  }

  if (!chainSub.active) {
    return (
      <div className="space-y-6">
        <Card className="border-white/5">
          <div className="text-center space-y-3 py-6">
            <div className="text-lg font-bold text-white/40">No Active Agent</div>
            <p className="text-[13px] text-white/30">
              You haven&apos;t launched an agent yet. Subscribe to claim your name and deploy.
            </p>
            <button
              onClick={onGoToLaunch}
              className="px-6 py-2 rounded-lg text-[11px] font-bold bg-purple-500/80 text-white hover:bg-purple-500 active:scale-95 transition-all"
            >
              LAUNCH YOUR AGENT
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // Calculate expiry
  const PERIOD_SECS = 30 * 86400;
  const nowSec = Date.now() / 1000;
  const secsLeft = Math.max(0, chainSub.expiresAt - nowSec);
  const daysLeft = Math.floor(secsLeft / 86400);
  const hoursLeft = Math.floor((secsLeft % 86400) / 3600);
  const pctLeft = Math.min(100, Math.max(0, (secsLeft / PERIOD_SECS) * 100));

  const tierName = ['', 'Starter', 'Pro', 'Enterprise'][chainSub.tier] || '?';

  return (
    <div className="space-y-6">
      {/* Agent Card */}
      <Card className="border-purple-500/20 bg-purple-500/[0.03]">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xl font-bold text-purple-300">{chainSub.agentName || 'unnamed'}</div>
              <div className="text-[11px] font-mono text-purple-300/40 mt-0.5">
                {chainSub.agentName}.agora.jumpbox.tech
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-[9px] font-mono text-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              ACTIVE
            </span>
          </div>

          {/* Tier + Expiry */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-white/40">{tierName} tier</span>
              <span className="text-white/60">Expires in {daysLeft}d {hoursLeft}h</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pctLeft}%`,
                  background: pctLeft > 20 ? COLORS.purple : pctLeft > 5 ? COLORS.warn : COLORS.danger,
                }}
              />
            </div>
            <div className="text-[9px] font-mono text-white/20 text-right">{Math.round(pctLeft)}% remaining</div>
          </div>

          {/* PayTo */}
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-white/30">Revenue to</span>
            <a
              href={`https://basescan.org/address/${chainSub.payTo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent/60 hover:text-accent transition-colors"
            >
              {truncAddr(chainSub.payTo)}
            </a>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => chainSub.renew()}
              disabled={chainSub.isPending}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 active:scale-95 transition-all"
            >
              {chainSub.isPending ? 'CONFIRMING...' : 'RENEW +30 DAYS'}
            </button>
            <button
              onClick={() => {
                setUpdateName(chainSub.agentName);
                setUpdatePayTo(chainSub.payTo);
                setShowUpdateForm(!showUpdateForm);
              }}
              className="flex-1 py-2 rounded-lg text-[11px] font-bold border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 transition-all"
            >
              UPDATE SETTINGS
            </button>
          </div>

          {/* Update form */}
          {showUpdateForm && (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="text-[9px] font-mono text-white/20">UPDATE AGENT</div>
              <input
                value={updateName}
                onChange={e => setUpdateName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="Agent name"
                maxLength={63}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-purple-500/30"
              />
              <input
                value={updatePayTo}
                onChange={e => setUpdatePayTo(e.target.value)}
                placeholder="PayTo address (0x...)"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-purple-500/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (address && updateName && updatePayTo) {
                      chainSub.updateAgent(updateName, updatePayTo as `0x${string}`);
                      setShowUpdateForm(false);
                    }
                  }}
                  disabled={chainSub.isPending || !updateName || !updatePayTo}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all"
                >
                  SAVE
                </button>
                <button
                  onClick={() => setShowUpdateForm(false)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 text-white/30 hover:text-white/50 transition-all"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Placeholder Dashboard */}
      <Section title="AGENT DASHBOARD">
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-white/30">Metrics</span>
              <span className="text-[8px] font-mono text-white/15 px-2 py-0.5 rounded border border-white/5">COMING SOON</span>
            </div>

            {/* Metric placeholders */}
            <div className="grid grid-cols-3 gap-3">
              {['REQUESTS', 'REVENUE', 'UPTIME'].map(label => (
                <div key={label} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-[8px] font-mono text-white/20 mb-1">{label}</div>
                  <div className="text-lg font-bold text-white/10">---</div>
                </div>
              ))}
            </div>

            {/* Skeleton endpoints */}
            <div className="space-y-2">
              <div className="text-[9px] font-mono text-white/20">ENDPOINTS</div>
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 rounded-lg bg-white/[0.02] border border-white/5 animate-pulse" />
              ))}
            </div>

            <p className="text-[11px] text-white/25 text-center leading-relaxed">
              Your agent infrastructure is being provisioned.
              This dashboard will activate when your Vercel deployment goes live.
            </p>
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ─── Docs Tab ───────────────────────────────────────────────────────────────

function DocsTab() {
  return (
    <div className="space-y-6">
      {/* How it works */}
      <Section title="HOW AGENT SUBSCRIPTIONS WORK">
        <Card>
          <div className="space-y-3 text-[11px] font-mono text-white/50">
            {[
              { step: '01', title: 'Subscribe with $AGORA', desc: 'Choose a tier and claim your unique agent name. Payment is split: 50% burned, 50% to treasury.' },
              { step: '02', title: 'Agora provisions your deployment', desc: 'A Vercel project is created from the agent template. Your subdomain goes live at name.agora.jumpbox.tech.' },
              { step: '03', title: 'Configure your agent', desc: 'Set up your x402 endpoints, configure pricing, and customize your agent\'s behavior.' },
              { step: '04', title: 'Earn revenue', desc: 'x402 micropayments flow through your endpoints. Revenue is sent to your configured payTo address.' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <span className="text-purple-400 font-bold w-5 flex-shrink-0">{s.step}</span>
                <div>
                  <span className="text-white/80">{s.title}</span>
                  <div className="text-white/30 mt-0.5">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* Tier comparison */}
      <Section title="TIER COMPARISON">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 text-white/20 font-normal">Feature</th>
                  <th className="text-center py-2 text-purple-300/60 font-bold">Starter</th>
                  <th className="text-center py-2 text-purple-300/60 font-bold">Pro</th>
                  <th className="text-center py-2 text-purple-300/60 font-bold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {TIER_COMPARISON.map(row => (
                  <tr key={row.feature} className="border-b border-white/[0.03]">
                    <td className="py-2 text-white/40">{row.feature}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="py-2 text-center text-white/60">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>

      {/* Smart Contracts */}
      <Section title="SMART CONTRACTS — BASE MAINNET">
        <Card>
          <div className="space-y-2">
            {[
              { name: 'Agent Subscriptions', address: '0x4FF5385a533FF88fc848946cB13974F44201896b', role: 'Subscribe, renew, update agents' },
              { name: '$AGORA Token', address: '0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131', role: 'ERC-20 payment token' },
              { name: 'Dead Address', address: '0x000000000000000000000000000000000000dEaD', role: 'Burn destination (50% of subs)' },
            ].map(c => (
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

      {/* Configuring your agent */}
      <Section title="CONFIGURING YOUR AGENT">
        <Card>
          <div className="space-y-4 text-[11px] text-white/50 leading-relaxed">
            <p>
              After subscribing, your agent is deployed from the Agora agent template — a Next.js project with x402 middleware pre-configured.
            </p>
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-purple-400/60">WHAT YOU GET</div>
              {[
                'Next.js project deployed to Vercel',
                'x402 middleware with per-route pricing',
                'Subdomain: yourname.agora.jumpbox.tech',
                'Revenue routing to your payTo address',
                'USDC payments on Base mainnet',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-[10px]">
                  <span className="text-purple-400/60">+</span>
                  <span className="text-white/40">{item}</span>
                </div>
              ))}
            </div>
            <div className="text-[9px] font-mono text-white/15 mt-2">
              Detailed configuration docs will be available when agent provisioning goes live.
            </div>
          </div>
        </Card>
      </Section>

      {/* FAQ */}
      <Section title="FAQ">
        <Card>
          <div className="space-y-4">
            {FAQ_ITEMS.map(faq => (
              <div key={faq.q} className="space-y-1">
                <div className="text-[11px] font-mono text-white/70">{faq.q}</div>
                <div className="text-[10px] text-white/35 leading-relaxed">{faq.a}</div>
              </div>
            ))}
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

type AgentTab = 'overview' | 'launch' | 'agent' | 'docs';

export default function AgentsClient() {
  const [tab, setTab] = useState<AgentTab>('overview');
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const chainSub = useAgoraAgentSub(address as `0x${string}` | undefined);
  const chainStake = useAgoraStaking(address as `0x${string}` | undefined);

  // Auto-navigate to MY AGENT tab if subscription confirmed
  useEffect(() => {
    if (chainSub.isConfirmed && tab === 'launch') {
      chainSub.refetchAll();
      chainSub.reset();
      setTab('agent');
    }
  }, [chainSub.isConfirmed, tab]);

  const TABS: { id: AgentTab; label: string }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'launch', label: 'LAUNCH' },
    { id: 'agent', label: 'MY AGENT' },
    { id: 'docs', label: 'DOCS' },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-surface relative overflow-auto">
      <div className="scanline" />
      <div className="noise" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-[9px] font-mono tracking-[0.3em] text-purple-400/60 mb-1">$AGORA ON BASE</div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AGENT LAUNCHPAD</h1>
          <p className="text-[11px] text-white/30 mt-1">Deploy your own x402 agent on Agora infrastructure</p>
        </div>

        {/* Wallet status */}
        <div className="flex items-center justify-center gap-3">
          {isConnected ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg border border-white/5 bg-surface-card">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-[10px] font-mono text-white/40">{truncAddr(address || '')}</span>
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="px-4 py-1.5 rounded-lg text-[10px] font-mono border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition-all"
            >
              CONNECT WALLET
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-mono tracking-wider transition-all ${
                tab === t.id
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                  : 'text-white/25 border border-white/5 hover:text-white/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'overview' && (
          <OverviewTab
            totalActive={chainSub.totalActive}
            totalBurned={chainSub.totalBurned}
            onGetStarted={() => setTab('launch')}
          />
        )}
        {tab === 'launch' && (
          <LaunchTab
            isConnected={isConnected}
            chainSub={chainSub}
            chainStake={chainStake}
            onGoToAgent={() => setTab('agent')}
          />
        )}
        {tab === 'agent' && (
          <MyAgentTab
            isConnected={isConnected}
            chainSub={chainSub}
            onGoToLaunch={() => setTab('launch')}
          />
        )}
        {tab === 'docs' && <DocsTab />}

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 py-4">
          <Link href="/" className="text-[10px] font-mono text-accent/50 hover:text-accent transition-colors">
            PLAY AGORA
          </Link>
          <span className="text-white/10">&middot;</span>
          <Link href="/stats" className="text-[10px] font-mono text-accent/50 hover:text-accent transition-colors">
            PROTOCOL STATS
          </Link>
          <span className="text-white/10">&middot;</span>
          <Link href="/docs" className="text-[10px] font-mono text-accent/50 hover:text-accent transition-colors">
            GAME DOCS
          </Link>
          <span className="text-white/10">&middot;</span>
          <a href="https://github.com/jumpboxtech/agora" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-accent/50 hover:text-accent transition-colors">
            GITHUB
          </a>
        </div>
      </div>
    </div>
  );
}
