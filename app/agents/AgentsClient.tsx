'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseEther, formatEther } from 'viem';
import { useAgoraAgentSub, SUB_TIERS } from '../lib/useAgoraAgentSub';
import { formatTokenAmount } from '../lib/useAgoraStaking';
import { useAgoraLaunchpad, type CurveData, type EndpointData } from '../lib/useAgoraLaunchpad';

/** Format USDC amount (6 decimals) for display */
function formatUSDC(amount: bigint): string {
  const whole = amount / BigInt(1_000_000);
  const frac = amount % BigInt(1_000_000);
  if (frac === BigInt(0)) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole.toLocaleString()}.${fracStr}`;
}
import {
  AGORA_AGENT_SUB,
  AGORA_LAUNCHPAD,
  AGORA_ENDPOINT_REGISTRY,
  AGORA_ROUTER,
  AGENT_SUB_ABI,
  LAUNCHPAD_ABI,
  ENDPOINT_REGISTRY_ABI,
} from '../lib/contracts';

// ─── Available Datasets ──────────────────────────────────────────────────────

const AVAILABLE_DATASETS = [
  { id: 'curves', path: 'api/v1/curves', price: '$0.01', agoraPrice: parseEther('100'), description: 'Bonding curve data — price, reserve, graduation %' },
  { id: 'signals', path: 'api/v1/signals', price: '$0.02', agoraPrice: parseEther('200'), description: 'Agent signals — tasks, earnings, market metrics' },
  { id: 'directory', path: 'api/v1/directory', price: '$0.01', agoraPrice: parseEther('100'), description: 'Agent directory — profiles, endpoints, stats' },
] as const;

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
  { feature: 'Monthly cost', values: ['$10', '$25', '$50'] },
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
    a: 'Subscriptions are paid in USDC. 50% is auto-swapped to $AGORA via Uniswap V3 and sent to the dead address (0x...dEaD), permanently removed from circulation. The other 50% goes to the protocol treasury in USDC.',
  },
  {
    q: 'What is a bonding curve token?',
    a: 'When you launch a token on the launchpad, it creates a bonding curve — a smart contract that automatically prices your agent token based on supply and demand. As more people buy, the price increases. At the graduation threshold (5B $AGORA), liquidity is automatically seeded on Uniswap V3.',
  },
  {
    q: 'What are payment modes?',
    a: 'Each endpoint can be configured as Mode 0 (Curve) or Mode 1 (Direct). Curve mode uses x402 payments to buy your agent token, creating buy pressure. Direct mode sends $AGORA straight to your payTo address.',
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

function OverviewTab({ totalActive, totalBurned, totalCurves, onGetStarted }: {
  totalActive: number;
  totalBurned: bigint;
  totalCurves: number;
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
            Launch your x402 agent with a bonding curve token backed by $AGORA.
            Subscribe, deploy your API, launch your token, and start earning revenue.
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
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="ACTIVE AGENTS" value={String(totalActive)} color={COLORS.purple} />
          <StatCard label="CURVES LAUNCHED" value={String(totalCurves)} color={COLORS.info} />
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
              { step: '02', title: 'Subscribe', desc: 'pay USDC to claim your agent name — 50% auto-buys & burns $AGORA' },
              { step: '03', title: 'Launch token', desc: 'create your bonding curve backed by $AGORA' },
              { step: '04', title: 'Register endpoints', desc: 'configure your API routes with per-endpoint pricing' },
              { step: '05', title: 'Earn revenue', desc: 'x402 payments flow through your curve or direct to you' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <span className="text-purple-400 font-bold w-5 flex-shrink-0">{s.step}</span>
                <span><span className="text-white/80">{s.title}</span> — {s.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* Active Agents */}
      <Section title="ACTIVE AGENTS">
        <Card>
          <div className="text-center py-6">
            <div className="text-3xl font-bold text-purple-400 mb-2">{totalActive}</div>
            <div className="text-[11px] text-white/30">agents live on Agora infrastructure</div>
            <div className="text-[9px] font-mono text-white/15 mt-3">Browse the marketplace tab to see all agents</div>
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ─── Launch Tab ─────────────────────────────────────────────────────────────

function LaunchTab({ isConnected, chainSub, launchpad, onGoToAgent }: {
  isConnected: boolean;
  chainSub: ReturnType<typeof useAgoraAgentSub>;
  launchpad: ReturnType<typeof useAgoraLaunchpad>;
  onGoToAgent: () => void;
}) {
  const { address } = useAccount();
  const [selectedTier, setSelectedTier] = useState(1);
  const [agentName, setAgentName] = useState('');
  const [nameToCheck, setNameToCheck] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const nameCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [subdomainRegistered, setSubdomainRegistered] = useState(false);
  const [subdomainError, setSubdomainError] = useState('');
  const [registeringSubdomain, setRegisteringSubdomain] = useState(false);
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(new Set(['curves', 'signals', 'directory']));
  const [githubToken, setGithubToken] = useState('');
  const [repoName, setRepoName] = useState('');
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');
  const [exportUrl, setExportUrl] = useState('');

  // Check if subdomain is already registered on mount
  useEffect(() => {
    if (!chainSub.agentName || subdomainRegistered) return;
    fetch(`/api/agents/register-name?name=${encodeURIComponent(chainSub.agentName)}`)
      .then(r => r.json())
      .then(data => {
        if (data.available === false) setSubdomainRegistered(true);
      })
      .catch(() => {});
  }, [chainSub.agentName, subdomainRegistered]);

  const registerSubdomain = useCallback(async () => {
    if (!chainSub.agentName || !address) return;
    setRegisteringSubdomain(true);
    setSubdomainError('');
    try {
      const res = await fetch('/api/agents/register-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: chainSub.agentName, address }),
      });
      const data = await res.json();
      if (res.ok || data.error === 'Name already taken') {
        setSubdomainRegistered(true);
      } else {
        setSubdomainError(data.error || 'Registration failed');
      }
    } catch {
      setSubdomainError('Network error');
    }
    setRegisteringSubdomain(false);
  }, [chainSub.agentName, address]);

  const exportToGithub = useCallback(async () => {
    if (!githubToken || !repoName || !chainSub.agentName) return;
    setExportStatus('exporting');
    try {
      const endpoints = AVAILABLE_DATASETS
        .filter(d => selectedDatasets.has(d.id))
        .map(d => ({ path: d.path, price: d.price, description: d.description }));

      const res = await fetch('/api/agents/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubToken, repoName, agentName: chainSub.agentName, endpoints }),
      });
      const data = await res.json();
      if (res.ok) {
        setExportStatus('done');
        setExportUrl(data.repoUrl);
      } else {
        setExportStatus('error');
        setSubdomainError(data.error || 'Export failed');
      }
    } catch {
      setExportStatus('error');
    }
  }, [githubToken, repoName, chainSub.agentName, selectedDatasets]);

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

  // Not connected
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <Card className="border-purple-500/20 bg-purple-500/[0.03]">
          <div className="text-center space-y-3 py-4">
            <div className="text-lg font-bold text-white/80">Connect Your Wallet</div>
            <p className="text-[13px] text-white/40">
              Connect your wallet to subscribe and launch your agent.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Already subscribed + token launched + endpoints registered — go to My Agent
  const hasEndpoints = launchpad.profile && launchpad.profile.endpointCount > 0;
  if (chainSub.active && launchpad.hasLaunched && hasEndpoints) {
    return (
      <div className="space-y-6">
        <Card className="border-purple-500/20 bg-purple-500/[0.03]">
          <div className="text-center space-y-3">
            <div className="text-[9px] font-mono text-accent">FULLY LAUNCHED</div>
            <p className="text-[13px] text-white/50">
              Your agent, token, and API endpoints are live. Manage everything from the My Agent tab.
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

  const tierDef = SUB_TIERS.find(t => t.tier === selectedTier);
  const tierCost = tierDef?.cost ?? BigInt(0);
  const needsApprove = chainSub.needsApproval(tierCost);
  const canAfford = chainSub.balance >= tierCost;

  return (
    <div className="space-y-6">
      {/* Step 1 — Choose tier (only if not subscribed) */}
      {!chainSub.active && (
        <>
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
                    <div className="mb-3">
                      <div className="text-[16px] font-bold" style={{ color: COLORS.purple }}>{sub?.usd}</div>
                      <div className="text-[9px] font-mono text-white/20">{sub?.label}</div>
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
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white/40">Your USDC balance</span>
                  <span className="text-white/60">{formatUSDC(chainSub.balance)} USDC</span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white/40">Subscription cost</span>
                  <span className="text-purple-300">{tierDef?.usd} <span className="text-white/20">({tierDef?.label})</span></span>
                </div>

                {!canAfford && (
                  <div className="text-[10px] font-mono text-warn/70 text-center py-1">
                    Insufficient USDC balance
                  </div>
                )}

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
                      ? 'APPROVE USDC'
                      : `SUBSCRIBE — ${tierDef?.usd}`}
                </button>

                <div className="text-[9px] font-mono text-white/15 text-center">
                  50% auto-buys &amp; burns $AGORA &middot; 50% to protocol treasury &middot; 30 days per period
                </div>
              </div>
            </Card>
          </Section>
        </>
      )}

      {/* Step 4 — Register Subdomain (after subscription, before token) */}
      {chainSub.active && !subdomainRegistered && (
        <Section title="STEP 4 — REGISTER SUBDOMAIN">
          <Card className="border-purple-500/20 bg-purple-500/[0.03]">
            <div className="space-y-3">
              <div className="text-[11px] text-white/50 leading-relaxed">
                Register your subdomain to serve x402-gated API endpoints.
              </div>
              <div className="text-[13px] font-mono text-purple-300">
                https://{chainSub.agentName}.agora.jumpbox.tech
              </div>
              {subdomainError && (
                <div className="text-[10px] font-mono text-danger">{subdomainError}</div>
              )}
              <button
                onClick={registerSubdomain}
                disabled={registeringSubdomain}
                className="w-full py-3 rounded-lg text-[12px] font-bold bg-purple-500/80 text-white hover:bg-purple-500 active:scale-[0.98] transition-all"
              >
                {registeringSubdomain ? 'REGISTERING...' : 'REGISTER SUBDOMAIN'}
              </button>
            </div>
          </Card>
        </Section>
      )}

      {chainSub.active && subdomainRegistered && (
        <Card className="border-accent/20 bg-accent/[0.03]">
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-accent">SUBDOMAIN REGISTERED</span>
            <span className="text-white/30">|</span>
            <a
              href={`https://${chainSub.agentName}.agora.jumpbox.tech`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent/60 hover:text-accent transition-colors"
            >
              {chainSub.agentName}.agora.jumpbox.tech
            </a>
          </div>
        </Card>
      )}

      {/* Step 5 — Launch Token (only visible if subscribed but not launched) */}
      {chainSub.active && !launchpad.hasLaunched && (
        <Section title="STEP 5 — LAUNCH YOUR TOKEN">
          <Card className="border-purple-500/20 bg-purple-500/[0.03]">
            <div className="space-y-4">
              <div className="text-[11px] text-white/50 leading-relaxed">
                Create a bonding curve token for your agent. The token price starts low and increases with demand.
                At 5B $AGORA reserve, the curve auto-graduates to a Uniswap V3 pool.
              </div>

              <div className="space-y-2">
                <input
                  value={tokenName}
                  onChange={e => setTokenName(e.target.value)}
                  placeholder="Agent Token Name"
                  maxLength={32}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[13px] font-mono text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/30 transition-colors"
                />
                <input
                  value={tokenSymbol}
                  onChange={e => setTokenSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="SYMBOL"
                  maxLength={10}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[13px] font-mono text-white/80 placeholder:text-white/20 outline-none focus:border-purple-500/30 transition-colors"
                />
              </div>

              <div className="space-y-1 text-[9px] font-mono text-white/20">
                <div>Total supply: 1,000,000,000 tokens</div>
                <div>Fee: 1% (80% to creator, 20% to protocol)</div>
                <div>Graduation: 5,000,000,000 $AGORA reserve</div>
              </div>

              <button
                onClick={() => {
                  if (tokenName && tokenSymbol) {
                    launchpad.launch(tokenName, tokenSymbol);
                  }
                }}
                disabled={!tokenName || !tokenSymbol || launchpad.isPending}
                className={`w-full py-3 rounded-lg text-[12px] font-bold transition-all ${
                  tokenName && tokenSymbol
                    ? 'bg-purple-500/80 text-white hover:bg-purple-500 active:scale-[0.98]'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                {launchpad.isPending ? 'LAUNCHING...' : 'LAUNCH TOKEN'}
              </button>
            </div>
          </Card>
        </Section>
      )}

      {/* Step 6 — Register Endpoints (after token launch) */}
      {chainSub.active && launchpad.hasLaunched && !hasEndpoints && (
        <Section title="STEP 6 — REGISTER API ENDPOINTS">
          <Card>
            <div className="space-y-3">
              <div className="text-[11px] text-white/50 leading-relaxed">
                Register your agent&apos;s API endpoints on-chain. Other agents and clients will discover your endpoints via the registry.
                Payments route through your bonding curve (Curve mode) or directly to your payTo address (Direct mode).
              </div>
              {AVAILABLE_DATASETS.map(d => (
                <label key={d.id} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-white/5 bg-white/[0.02] cursor-pointer hover:border-white/10 transition-all">
                  <input
                    type="checkbox"
                    checked={selectedDatasets.has(d.id)}
                    onChange={e => {
                      const next = new Set(selectedDatasets);
                      e.target.checked ? next.add(d.id) : next.delete(d.id);
                      setSelectedDatasets(next);
                    }}
                    className="mt-0.5 accent-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-white/70">/{d.path}</span>
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300">{d.price} USDC</span>
                      <span className="text-[8px] font-mono text-white/20">{formatEther(d.agoraPrice)} AGORA</span>
                    </div>
                    <div className="text-[9px] text-white/30 mt-0.5">{d.description}</div>
                  </div>
                </label>
              ))}

              <button
                onClick={() => {
                  const selected = AVAILABLE_DATASETS.filter(d => selectedDatasets.has(d.id));
                  if (selected.length === 0) return;
                  const endpointUrl = `https://${chainSub.agentName}.agora.jumpbox.tech`;
                  const paths = selected.map(d => d.path);
                  const prices = selected.map(d => d.agoraPrice);
                  const modes = selected.map(() => 0); // 0 = Curve mode
                  launchpad.registerEndpoints(endpointUrl, paths, prices, modes);
                }}
                disabled={selectedDatasets.size === 0 || launchpad.isPending}
                className={`w-full py-3 rounded-lg text-[12px] font-bold transition-all ${
                  selectedDatasets.size > 0
                    ? 'bg-purple-500/80 text-white hover:bg-purple-500 active:scale-[0.98]'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                {launchpad.isPending ? 'REGISTERING...' : `REGISTER ${selectedDatasets.size} ENDPOINT${selectedDatasets.size !== 1 ? 'S' : ''}`}
              </button>
            </div>
          </Card>
        </Section>
      )}

      {/* Step 7 — Export to GitHub (optional) */}
      {chainSub.active && launchpad.hasLaunched && !hasEndpoints && (
        <Section title="STEP 7 — EXPORT TO GITHUB (OPTIONAL)">
          <Card>
            <div className="space-y-3">
              <div className="text-[11px] text-white/50 leading-relaxed">
                Generate a standalone Next.js project with your x402 endpoints and push it to your GitHub. You can then deploy and customize it.
              </div>

              <input
                value={githubToken}
                onChange={e => setGithubToken(e.target.value)}
                placeholder="GitHub Personal Access Token"
                type="password"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-purple-500/30"
              />
              <input
                value={repoName}
                onChange={e => setRepoName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="repository-name"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-purple-500/30"
              />

              <div className="text-[9px] font-mono text-white/15">
                Token stored in browser only. Needs repo:create scope. Your token is never sent to our servers — only to GitHub directly.
              </div>

              {exportStatus === 'done' && exportUrl && (
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-accent">EXPORTED</span>
                  <a href={exportUrl} target="_blank" rel="noopener noreferrer" className="text-accent/60 hover:text-accent transition-colors">
                    {exportUrl}
                  </a>
                </div>
              )}

              {exportStatus === 'error' && (
                <div className="text-[10px] font-mono text-danger">{subdomainError || 'Export failed'}</div>
              )}

              <button
                onClick={exportToGithub}
                disabled={!githubToken || !repoName || exportStatus === 'exporting' || selectedDatasets.size === 0}
                className={`w-full py-3 rounded-lg text-[12px] font-bold transition-all ${
                  githubToken && repoName && selectedDatasets.size > 0
                    ? 'bg-white/10 text-white/70 hover:bg-white/15 active:scale-[0.98]'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                {exportStatus === 'exporting' ? 'CREATING REPO...' : 'EXPORT TO GITHUB'}
              </button>
            </div>
          </Card>
        </Section>
      )}
    </div>
  );
}

// ─── My Agent Tab ───────────────────────────────────────────────────────────

function MyAgentTab({ isConnected, chainSub, launchpad, onGoToLaunch }: {
  isConnected: boolean;
  chainSub: ReturnType<typeof useAgoraAgentSub>;
  launchpad: ReturnType<typeof useAgoraLaunchpad>;
  onGoToLaunch: () => void;
}) {
  const { address } = useAccount();
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateName, setUpdateName] = useState('');
  const [updatePayTo, setUpdatePayTo] = useState('');
  const [showEndpointForm, setShowEndpointForm] = useState(false);
  const [epUrl, setEpUrl] = useState('');
  const [epPath, setEpPath] = useState('');
  const [epPrice, setEpPrice] = useState('');
  const [epMode, setEpMode] = useState<0 | 1>(0);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [ghToken, setGhToken] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [ghStatus, setGhStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');
  const [ghUrl, setGhUrl] = useState('');

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
  const { curve, price, graduationPct, endpoints, profile } = launchpad;

  return (
    <div className="space-y-6">
      {/* Agent Card */}
      <Card className="border-purple-500/20 bg-purple-500/[0.03]">
        <div className="space-y-4">
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

          <div className="flex gap-2">
            {(() => {
              const renewCost = SUB_TIERS.find(t => t.tier === chainSub.tier)?.cost ?? BigInt(0);
              const renewNeedsApprove = chainSub.needsApproval(renewCost);
              const renewCanAfford = chainSub.balance >= renewCost;
              return (
                <button
                  onClick={() => {
                    if (renewNeedsApprove) {
                      chainSub.approve(renewCost);
                    } else {
                      chainSub.renew();
                    }
                  }}
                  disabled={chainSub.isPending || !renewCanAfford}
                  className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {chainSub.isPending
                    ? 'CONFIRMING...'
                    : !renewCanAfford
                      ? 'INSUFFICIENT USDC'
                      : renewNeedsApprove
                        ? 'APPROVE USDC'
                        : 'RENEW +30 DAYS'}
                </button>
              );
            })()}

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

          {/* Subdomain + API Test */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-white/30">Subdomain</span>
              <a
                href={`https://${chainSub.agentName}.agora.jumpbox.tech`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent/60 hover:text-accent transition-colors"
              >
                {chainSub.agentName}.agora.jumpbox.tech
              </a>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/agent/${chainSub.agentName}`}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center border border-purple-500/20 text-purple-300/60 hover:text-purple-300 hover:border-purple-500/40 transition-all"
              >
                PUBLIC PROFILE
              </Link>
              <Link
                href="/agent/configure"
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center border border-cyan-500/20 text-cyan-300/60 hover:text-cyan-300 hover:border-cyan-500/40 transition-all"
              >
                CONFIGURE DATA
              </Link>
              <button
                onClick={async () => {
                  setTestResult(null);
                  try {
                    const res = await fetch(`/api/agent/${chainSub.agentName}/info`);
                    const data = await res.json();
                    setTestResult(res.ok ? JSON.stringify(data, null, 2) : `Error: ${data.error}`);
                  } catch {
                    setTestResult('Network error — agent may not be registered yet');
                  }
                }}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-accent/20 text-accent/60 hover:text-accent hover:border-accent/40 transition-all"
              >
                TEST API
              </button>
              <button
                onClick={() => setShowExport(!showExport)}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 text-white/30 hover:text-white/50 hover:border-white/20 transition-all"
              >
                EXPORT TO GITHUB
              </button>
            </div>
            {testResult && (
              <pre className="p-3 rounded-lg bg-black/30 text-[9px] font-mono text-accent/70 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                {testResult}
              </pre>
            )}
            {showExport && (
              <div className="space-y-2 pt-2">
                <input
                  value={ghToken}
                  onChange={e => setGhToken(e.target.value)}
                  placeholder="GitHub Personal Access Token"
                  type="password"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-purple-500/30"
                />
                <input
                  value={ghRepo}
                  onChange={e => setGhRepo(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="repository-name"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-purple-500/30"
                />
                {ghStatus === 'done' && ghUrl && (
                  <div className="text-[10px] font-mono text-accent">
                    Exported: <a href={ghUrl} target="_blank" rel="noopener noreferrer" className="underline">{ghUrl}</a>
                  </div>
                )}
                {ghStatus === 'error' && (
                  <div className="text-[10px] font-mono text-danger">Export failed</div>
                )}
                <button
                  onClick={async () => {
                    if (!ghToken || !ghRepo) return;
                    setGhStatus('exporting');
                    try {
                      const res = await fetch('/api/agents/export', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ githubToken: ghToken, repoName: ghRepo, agentName: chainSub.agentName }),
                      });
                      const data = await res.json();
                      if (res.ok) { setGhStatus('done'); setGhUrl(data.repoUrl); }
                      else { setGhStatus('error'); }
                    } catch { setGhStatus('error'); }
                  }}
                  disabled={!ghToken || !ghRepo || ghStatus === 'exporting'}
                  className="w-full py-2 rounded-lg text-[10px] font-bold bg-white/10 text-white/70 hover:bg-white/15 transition-all"
                >
                  {ghStatus === 'exporting' ? 'CREATING...' : 'CREATE REPO'}
                </button>
              </div>
            )}
          </div>

          {/* Health Monitoring */}
          <HealthSection address={address!} agentName={chainSub.agentName} />

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

      {/* Token Curve Stats */}
      {launchpad.hasLaunched && curve && (
        <Section title="TOKEN CURVE">
          <Card>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-[8px] font-mono text-white/20 mb-1">PRICE</div>
                  <div className="text-sm font-bold text-purple-300">{price.toFixed(6)}</div>
                  <div className="text-[8px] text-white/15">$AGORA/token</div>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-[8px] font-mono text-white/20 mb-1">RESERVE</div>
                  <div className="text-sm font-bold text-info">{formatTokenAmount(curve.agoraReserve)}</div>
                  <div className="text-[8px] text-white/15">$AGORA</div>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-[8px] font-mono text-white/20 mb-1">SOLD</div>
                  <div className="text-sm font-bold text-accent">{formatTokenAmount(curve.tokensSold)}</div>
                  <div className="text-[8px] text-white/15">tokens</div>
                </div>
              </div>

              {/* Graduation progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-white/30">Graduation progress</span>
                  <span className="text-white/50">{graduationPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${graduationPct}%` }}
                  />
                </div>
                <div className="text-[8px] font-mono text-white/15">
                  {curve.graduated
                    ? 'Graduated to Uniswap V3'
                    : `${formatTokenAmount(curve.agoraReserve)} / ${formatTokenAmount(curve.graduationAgora)} $AGORA`}
                </div>
              </div>

              {curve.graduated && curve.uniswapPool !== '0x0000000000000000000000000000000000000000' && (
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-accent">Uniswap V3 Pool</span>
                  <a
                    href={`https://basescan.org/address/${curve.uniswapPool}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent/60 hover:text-accent transition-colors"
                  >
                    {truncAddr(curve.uniswapPool)}
                  </a>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-white/30">Token contract</span>
                <a
                  href={`https://basescan.org/address/${curve.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent/60 hover:text-accent transition-colors"
                >
                  {truncAddr(curve.token)}
                </a>
              </div>
            </div>
          </Card>
        </Section>
      )}

      {/* Endpoints */}
      <Section title="ENDPOINTS">
        <Card>
          <div className="space-y-3">
            {profile && (
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-[8px] font-mono text-white/20">TASKS</div>
                  <div className="text-sm font-bold text-purple-300">{profile.totalTasks}</div>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-[8px] font-mono text-white/20">EARNED</div>
                  <div className="text-sm font-bold text-accent">{formatTokenAmount(profile.totalEarned)}</div>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-[8px] font-mono text-white/20">ROUTES</div>
                  <div className="text-sm font-bold text-info">{profile.endpointCount}</div>
                </div>
              </div>
            )}

            {/* Existing endpoints */}
            {endpoints && endpoints.length > 0 ? (
              <div className="space-y-2">
                {endpoints.map((ep, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${ep.active ? 'border-white/5 bg-white/[0.02]' : 'border-white/[0.03] bg-white/[0.01] opacity-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-white/70">{ep.path}</span>
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${ep.paymentMode === 0 ? 'bg-purple-500/10 text-purple-300' : 'bg-accent/10 text-accent'}`}>
                        {ep.paymentMode === 0 ? 'CURVE' : 'DIRECT'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-white/30">
                        {formatTokenAmount(ep.priceAgora)} $AGORA
                      </span>
                      {ep.active && (
                        <button
                          onClick={() => launchpad.removeEndpoint(ep.path)}
                          className="text-[8px] font-mono text-danger/50 hover:text-danger transition-colors"
                        >
                          REMOVE
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-white/25 text-center py-4">
                No endpoints registered yet
              </div>
            )}

            {/* Add endpoint form */}
            <button
              onClick={() => setShowEndpointForm(!showEndpointForm)}
              className="w-full py-2 rounded-lg text-[10px] font-bold border border-dashed border-white/10 text-white/30 hover:text-white/50 hover:border-white/20 transition-all"
            >
              {showEndpointForm ? 'CANCEL' : '+ ADD ENDPOINT'}
            </button>

            {showEndpointForm && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <input
                  value={epUrl}
                  onChange={e => setEpUrl(e.target.value)}
                  placeholder="Base URL (https://my-agent.agora.jumpbox.tech)"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-purple-500/30"
                />
                <input
                  value={epPath}
                  onChange={e => setEpPath(e.target.value)}
                  placeholder="/api/v1/chat"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-purple-500/30"
                />
                <div className="flex gap-2">
                  <input
                    value={epPrice}
                    onChange={e => setEpPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="Price ($AGORA)"
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-purple-500/30"
                  />
                  <div className="flex rounded-lg border border-white/10 overflow-hidden">
                    <button
                      onClick={() => setEpMode(0)}
                      className={`px-3 py-2 text-[10px] font-mono transition-all ${epMode === 0 ? 'bg-purple-500/20 text-purple-300' : 'text-white/30'}`}
                    >
                      CURVE
                    </button>
                    <button
                      onClick={() => setEpMode(1)}
                      className={`px-3 py-2 text-[10px] font-mono transition-all ${epMode === 1 ? 'bg-accent/20 text-accent' : 'text-white/30'}`}
                    >
                      DIRECT
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (epUrl && epPath && epPrice) {
                      launchpad.registerEndpoints(
                        epUrl,
                        [epPath],
                        [parseEther(epPrice)],
                        [epMode],
                      );
                      setShowEndpointForm(false);
                      setEpPath('');
                      setEpPrice('');
                    }
                  }}
                  disabled={!epUrl || !epPath || !epPrice || launchpad.isPending}
                  className="w-full py-2 rounded-lg text-[10px] font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all"
                >
                  {launchpad.isPending ? 'REGISTERING...' : 'REGISTER ENDPOINT'}
                </button>
              </div>
            )}
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ─── Marketplace Tab ────────────────────────────────────────────────────────

function MarketplaceTab() {
  const { data: totalAgents } = useReadContract({
    address: AGORA_ENDPOINT_REGISTRY as `0x${string}`,
    abi: ENDPOINT_REGISTRY_ABI,
    functionName: 'totalRegisteredAgents',
    query: { refetchInterval: 30_000 },
  });

  const { data: totalCurves } = useReadContract({
    address: AGORA_LAUNCHPAD as `0x${string}`,
    abi: LAUNCHPAD_ABI,
    functionName: 'totalCurves',
    query: { refetchInterval: 30_000 },
  });

  const agentCount = totalAgents ? Number(totalAgents) : 0;
  const curveCount = totalCurves ? Number(totalCurves) : 0;

  return (
    <div className="space-y-6">
      <Section title="MARKETPLACE">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="REGISTERED AGENTS" value={String(agentCount)} color={COLORS.purple} />
          <StatCard label="BONDING CURVES" value={String(curveCount)} color={COLORS.info} />
        </div>
      </Section>

      <Section title="LAUNCHED AGENTS">
        <Card>
          {curveCount === 0 ? (
            <div className="text-center py-8">
              <div className="text-2xl mb-2 text-white/10">0</div>
              <div className="text-[11px] text-white/25">No agents have launched tokens yet</div>
              <div className="text-[9px] font-mono text-white/15 mt-2">Be the first to launch</div>
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: Math.min(curveCount, 20) }, (_, i) => (
                <CurveListItem key={i} curveId={i} />
              ))}
              {curveCount > 20 && (
                <div className="text-[10px] font-mono text-white/20 text-center pt-2">
                  ...and {curveCount - 20} more
                </div>
              )}
            </div>
          )}
        </Card>
      </Section>

      {agentCount > 0 && (
        <Section title="AGENTS WITH ENDPOINTS">
          <Card>
            <div className="space-y-2">
              {Array.from({ length: Math.min(agentCount, 20) }, (_, i) => (
                <AgentListItem key={i} index={i} />
              ))}
              {agentCount > 20 && (
                <div className="text-[10px] font-mono text-white/20 text-center pt-2">
                  ...and {agentCount - 20} more
                </div>
              )}
            </div>
          </Card>
        </Section>
      )}
    </div>
  );
}

function CurveListItem({ curveId }: { curveId: number }) {
  const { data: curveRaw } = useReadContract({
    address: AGORA_LAUNCHPAD as `0x${string}`,
    abi: LAUNCHPAD_ABI,
    functionName: 'getCurve',
    args: [BigInt(curveId)],
    query: { refetchInterval: 30_000 },
  });

  const { data: priceRaw } = useReadContract({
    address: AGORA_LAUNCHPAD as `0x${string}`,
    abi: LAUNCHPAD_ABI,
    functionName: 'getPrice',
    args: [BigInt(curveId)],
    query: { refetchInterval: 30_000 },
  });

  const curve = curveRaw as CurveData | undefined;

  const { data: subData } = useReadContract({
    address: AGORA_AGENT_SUB as `0x${string}`,
    abi: AGENT_SUB_ABI,
    functionName: 'getSubscription',
    args: curve ? [curve.creator as `0x${string}`] : undefined,
    query: { enabled: !!curve },
  });

  if (!curve) return null;

  const sub = subData as [number, bigint, string, string, boolean] | undefined;
  const agentName = sub ? sub[2] : '';
  const price = priceRaw ? Number(formatEther(priceRaw as bigint)) : 0;
  const graduationPct = curve.graduationAgora > BigInt(0)
    ? Math.min(100, Number((curve.agoraReserve * BigInt(100)) / curve.graduationAgora))
    : 0;

  const profileHref = agentName ? `/agent/${agentName}` : undefined;

  return (
    <Link
      href={profileHref || '#'}
      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:border-white/10 transition-all ${profileHref ? '' : 'pointer-events-none'}`}
    >
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[11px] font-bold text-white/80">{agentName || truncAddr(curve.creator)}</div>
          <div className="text-[9px] font-mono text-white/25">{truncAddr(curve.token)}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {curve.graduated ? (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-green-500/10 text-green-300">GRADUATED</span>
        ) : (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300">{graduationPct}%</span>
        )}
        <div className="text-right">
          <div className="text-[10px] font-mono text-accent">{price.toFixed(6)} AGORA</div>
          <div className="text-[8px] font-mono text-white/20">{formatTokenAmount(curve.tokensSold)} sold</div>
        </div>
      </div>
    </Link>
  );
}

function AgentListItem({ index }: { index: number }) {
  const { data: agentAddr } = useReadContract({
    address: AGORA_ENDPOINT_REGISTRY as `0x${string}`,
    abi: ENDPOINT_REGISTRY_ABI,
    functionName: 'getAgentAt',
    args: [BigInt(index)],
  });

  const { data: profileRaw } = useReadContract({
    address: AGORA_ENDPOINT_REGISTRY as `0x${string}`,
    abi: ENDPOINT_REGISTRY_ABI,
    functionName: 'profiles',
    args: agentAddr ? [agentAddr as `0x${string}`] : undefined,
    query: { enabled: !!agentAddr },
  });

  const { data: subData } = useReadContract({
    address: AGORA_AGENT_SUB as `0x${string}`,
    abi: AGENT_SUB_ABI,
    functionName: 'getSubscription',
    args: agentAddr ? [agentAddr as `0x${string}`] : undefined,
    query: { enabled: !!agentAddr },
  });

  const { data: launched } = useReadContract({
    address: AGORA_LAUNCHPAD as `0x${string}`,
    abi: LAUNCHPAD_ABI,
    functionName: 'hasLaunched',
    args: agentAddr ? [agentAddr as `0x${string}`] : undefined,
    query: { enabled: !!agentAddr },
  });

  if (!agentAddr) return null;

  const profile = profileRaw as [string, bigint, bigint, bigint] | undefined;
  const sub = subData as [number, bigint, string, string, boolean] | undefined;
  const agentName = sub ? sub[2] : '';
  const endpointUrl = profile ? profile[0] : '';
  const totalTasks = profile ? Number(profile[1]) : 0;
  const totalEarned = profile ? profile[2] : BigInt(0);
  const endpointCount = profile ? Number(profile[3]) : 0;

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:border-white/10 transition-all">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[11px] font-bold text-white/80">{agentName || truncAddr(agentAddr as string)}</div>
          <div className="text-[9px] font-mono text-white/25">{endpointCount} endpoints</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {launched && (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300">TOKEN</span>
        )}
        <div className="text-right">
          <div className="text-[10px] font-mono text-accent">{totalTasks} tasks</div>
          <div className="text-[8px] font-mono text-white/20">{formatTokenAmount(totalEarned)} earned</div>
        </div>
      </div>
    </div>
  );
}

// ─── Docs Tab ───────────────────────────────────────────────────────────────

function DocsTab() {
  return (
    <div className="space-y-6">
      <Section title="HOW AGENT SUBSCRIPTIONS WORK">
        <Card>
          <div className="space-y-3 text-[11px] font-mono text-white/50">
            {[
              { step: '01', title: 'Subscribe with USDC', desc: 'Choose a tier and claim your unique agent name. 50% auto-buys & burns $AGORA, 50% to treasury.' },
              { step: '02', title: 'Launch your token', desc: 'Create a bonding curve token backed by $AGORA. Price starts low and increases with demand.' },
              { step: '03', title: 'Register endpoints', desc: 'Configure your API routes with per-endpoint pricing and payment modes (Curve or Direct).' },
              { step: '04', title: 'Earn revenue', desc: 'x402 payments route through your bonding curve or directly to your payTo address. Fees accrue until graduation.' },
              { step: '05', title: 'Auto-graduation', desc: 'When your curve reaches 5B $AGORA reserve, it auto-graduates to a Uniswap V3 pool. LP is permanently locked.' },
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

      <Section title="SMART CONTRACTS — BASE MAINNET">
        <Card>
          <div className="space-y-2">
            {[
              { name: 'Agent Subscriptions', address: AGORA_AGENT_SUB, role: 'Subscribe, renew, update agents' },
              { name: '$AGORA Token', address: '0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131', role: 'ERC-20 payment token' },
              { name: 'Launchpad', address: AGORA_LAUNCHPAD, role: 'Bonding curve factory' },
              { name: 'Endpoint Registry', address: AGORA_ENDPOINT_REGISTRY, role: 'API route pricing + config' },
              { name: 'Router', address: AGORA_ROUTER, role: 'x402 payment router' },
              { name: 'Dead Address', address: '0x000000000000000000000000000000000000dEaD', role: 'Burn destination (50% of subs)' },
            ].map(c => (
              <div key={c.name} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-2.5 py-2 rounded-lg border border-white/5 bg-white/[0.02]">
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

      <Section title="PAYMENT MODES">
        <Card>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-purple-400/60">MODE 0 — CURVE</div>
              <p className="text-[11px] text-white/40 leading-relaxed">
                x402 payments buy your agent token on the bonding curve, creating buy pressure and increasing your token&apos;s price. After graduation, payments swap via Uniswap V3.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-accent/60">MODE 1 — DIRECT</div>
              <p className="text-[11px] text-white/40 leading-relaxed">
                x402 payments send $AGORA directly to your configured payTo address. No token involvement. Good for agents that want simple revenue without a token.
              </p>
            </div>
          </div>
        </Card>
      </Section>

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

// ─── Health Section (used inside MyAgentTab) ────────────────────────────────

type HealthCheckData = {
  path: string; name: string; type: string; status: 'up' | 'down' | 'unknown';
  latencyMs: number; lastChecked: number; consecutiveFailures: number; lastError: string | null;
};

function HealthSection({ address }: { address: string; agentName: string }) {
  const [checks, setChecks] = useState<HealthCheckData[]>([]);
  const [email, setEmail] = useState('');
  const [emailSet, setEmailSet] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [saving, setSaving] = useState(false);
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    fetch(`/api/agents/health?address=${address}`).then((r) => r.json()).then((d) => setChecks(d.checks || [])).catch(() => {});
    fetch(`/api/agents/email?address=${address}`).then((r) => r.json()).then((d) => { if (d.email) { setEmail(d.email); setEmailSet(true); } }).catch(() => {});
  }, [address]);

  const handleSetEmail = async () => {
    if (!emailInput) return;
    setSaving(true);
    try {
      const message = `Set Agora alert email: ${emailInput}`;
      const signature = await signMessageAsync({ message });
      const res = await fetch('/api/agents/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, email: emailInput, signature }),
      });
      if (res.ok) {
        setEmail(emailInput.replace(/^(.{2}).*@/, '$1***@'));
        setEmailSet(true);
        setEmailInput('');
      }
    } catch { /* user rejected */ }
    setSaving(false);
  };

  return (
    <div className="space-y-2 pt-2 border-t border-white/5">
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-mono text-white/20 tracking-wider">ENDPOINT HEALTH</div>
        {emailSet && <span className="text-[8px] font-mono text-white/20">alerts → {email}</span>}
      </div>

      {checks.length > 0 ? (
        <div className="space-y-1">
          {checks.map((c) => (
            <div key={c.path} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${c.status === 'up' ? 'bg-green-400' : c.status === 'down' ? 'bg-red-400 animate-pulse' : 'bg-white/20'}`} />
                <span className="text-[10px] font-mono text-white/60">{c.name}</span>
                <span className="text-[8px] font-mono text-white/20">{c.type}</span>
              </div>
              <div className="flex items-center gap-2">
                {c.status === 'up' && <span className="text-[9px] font-mono text-green-400/60">{c.latencyMs}ms</span>}
                {c.status === 'down' && <span className="text-[9px] font-mono text-red-400/60">{c.lastError?.slice(0, 20)}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[10px] font-mono text-white/20">No data sources configured</div>
      )}

      {!emailSet && (
        <div className="flex gap-2 pt-1">
          <input
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="alert-email@example.com"
            type="email"
            className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-white/70 placeholder:text-white/20 outline-none focus:border-purple-500/30"
          />
          <button
            onClick={handleSetEmail}
            disabled={saving || !emailInput}
            className="px-3 py-1.5 rounded-lg text-[9px] font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all disabled:opacity-50"
          >
            {saving ? '...' : 'SET EMAIL'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Directory Tab ──────────────────────────────────────────────────────────

type DirectoryAgent = {
  address: string; name: string; tier: number; active: boolean;
  totalTasks: number; totalEarned: string; endpointCount: number; hasToken: boolean;
};

function DirectoryTab() {
  const [agents, setAgents] = useState<DirectoryAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [tokenOnly, setTokenOnly] = useState(false);
  const [sort, setSort] = useState('tasks');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDirectory = useCallback(async (s: string, tier: number | null, token: boolean, srt: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set('search', s);
      if (tier !== null) params.set('tier', String(tier));
      if (token) params.set('hasToken', 'true');
      params.set('sort', srt);
      const res = await fetch(`/api/agents/directory?${params}`);
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDirectory(search, tierFilter, tokenOnly, sort); }, [tierFilter, tokenOnly, sort, fetchDirectory]);

  const onSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchDirectory(val, tierFilter, tokenOnly, sort), 300);
  };

  const tierBadge = (tier: number) => {
    const styles: Record<number, string> = {
      1: 'bg-green-500/10 text-green-300 border-green-500/20',
      2: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      3: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
    };
    const names: Record<number, string> = { 1: 'STARTER', 2: 'PRO', 3: 'ENTERPRISE' };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono border ${styles[tier] || 'text-white/30 border-white/10'}`}>
        {names[tier] || '?'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <Section title="AGENT DIRECTORY">
        {/* Search */}
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search agents..."
          className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-[11px] font-mono text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-500/30"
        />

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-mono text-white/30">TIER:</span>
          {[null, 1, 2, 3].map((t) => (
            <button
              key={String(t)}
              onClick={() => setTierFilter(t)}
              className={`px-2 py-1 rounded text-[9px] font-mono transition-all ${
                tierFilter === t ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-white/25 border border-white/5 hover:text-white/40'
              }`}
            >
              {t === null ? 'ALL' : ['', 'STARTER', 'PRO', 'ENTERPRISE'][t]}
            </button>
          ))}
          <span className="text-white/10 mx-1">|</span>
          <button
            onClick={() => setTokenOnly(!tokenOnly)}
            className={`px-2 py-1 rounded text-[9px] font-mono transition-all ${
              tokenOnly ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-white/25 border border-white/5 hover:text-white/40'
            }`}
          >
            TOKEN
          </button>
          <div className="flex-1" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-2 py-1 rounded bg-black/30 border border-white/10 text-[9px] font-mono text-white/60 focus:outline-none"
          >
            <option value="tasks">Tasks</option>
            <option value="revenue">Revenue</option>
            <option value="endpoints">Endpoints</option>
            <option value="name">Name</option>
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-surface-card border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Card>
            <div className="text-center py-6">
              <p className="text-[11px] text-white/30">No agents found</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.map((a) => (
              <Link key={a.address} href={`/agent/${a.name}`}>
                <Card className="hover:border-purple-500/30 transition-all cursor-pointer">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-bold text-white/90">{a.name || truncAddr(a.address)}</span>
                      <div className="flex items-center gap-1.5">
                        {tierBadge(a.tier)}
                        {a.hasToken && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            TOKEN
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-white/40">
                      <span>{a.endpointCount} endpoints</span>
                      <span className="text-white/10">&middot;</span>
                      <span>{a.totalTasks.toLocaleString()} tasks</span>
                    </div>
                    <div className="text-[10px] font-mono text-purple-300/60">
                      {parseFloat(a.totalEarned).toLocaleString(undefined, { maximumFractionDigits: 2 })} AGORA earned
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Analytics Tab ──────────────────────────────────────────────────────────

type AnalyticsSummary = {
  totalRequests: number;
  totalRevenue: number;
  byEndpoint: Record<string, { requests: number; revenue: number }>;
  daily: { date: string; requests: number; revenue: number }[];
  onChain: { totalTasks: number; totalEarned: string; endpointCount: number } | null;
};

function AnalyticsTab({ isConnected, address, chainSub }: {
  isConnected: boolean;
  address: `0x${string}` | undefined;
  chainSub: ReturnType<typeof useAgoraAgentSub>;
}) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rc, setRc] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    import('recharts').then((mod) => setRc(mod));
  }, []);

  useEffect(() => {
    if (!address || !chainSub.active) return;
    setLoading(true);
    fetch(`/api/agents/analytics?address=${address}&days=30`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address, chainSub.active]);

  if (!isConnected) {
    return (
      <Card className="border-purple-500/20 bg-purple-500/[0.03]">
        <div className="text-center py-4">
          <p className="text-[13px] text-white/40">Connect your wallet to view analytics</p>
        </div>
      </Card>
    );
  }

  if (!chainSub.active) {
    return (
      <Card className="border-white/5">
        <div className="text-center py-6">
          <p className="text-[13px] text-white/30">No active agent. Subscribe to view analytics.</p>
        </div>
      </Card>
    );
  }

  if (loading || !data) {
    return (
      <Section title="ANALYTICS">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-surface-card border border-white/5 animate-pulse" />
          ))}
        </div>
      </Section>
    );
  }

  const avgPerDay = data.daily.length > 0 ? data.totalRevenue / data.daily.length : 0;
  const topEndpoint = Object.entries(data.byEndpoint).sort((a, b) => b[1].requests - a[1].requests)[0];
  const epData = Object.entries(data.byEndpoint).map(([name, v]) => ({ name, requests: v.requests, revenue: v.revenue }));

  return (
    <div className="space-y-4">
      <Section title="ANALYTICS">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'TOTAL REQUESTS', value: data.totalRequests.toLocaleString() },
            { label: 'TOTAL REVENUE', value: `$${data.totalRevenue.toFixed(4)}` },
            { label: 'AVG / DAY', value: `$${avgPerDay.toFixed(4)}` },
            { label: 'TOP ENDPOINT', value: topEndpoint ? topEndpoint[0] : '—' },
          ].map((s) => (
            <Card key={s.label}>
              <div className="text-[8px] font-mono text-white/30 tracking-wider">{s.label}</div>
              <div className="text-[15px] font-bold text-purple-300 mt-1">{s.value}</div>
            </Card>
          ))}
        </div>

        {/* On-chain stats */}
        {data.onChain && (
          <Card className="border-purple-500/10">
            <div className="text-[8px] font-mono text-white/30 tracking-wider mb-2">ON-CHAIN (ENDPOINT REGISTRY)</div>
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="text-white/60">{data.onChain.totalTasks.toLocaleString()} tasks</span>
              <span className="text-white/10">&middot;</span>
              <span className="text-purple-300/60">{parseFloat(data.onChain.totalEarned).toLocaleString(undefined, { maximumFractionDigits: 2 })} AGORA</span>
              <span className="text-white/10">&middot;</span>
              <span className="text-white/40">{data.onChain.endpointCount} endpoints</span>
            </div>
          </Card>
        )}

        {/* Revenue trend chart */}
        {rc && data.daily.length > 0 && (
          <Card>
            <div className="text-[8px] font-mono text-white/30 tracking-wider mb-3">REVENUE (30 DAY)</div>
            <div className="h-48">
              <rc.ResponsiveContainer width="100%" height="100%">
                <rc.AreaChart data={data.daily}>
                  <rc.XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b6b80', fontFamily: 'monospace' }} tickFormatter={(v: string) => v.slice(5)} />
                  <rc.YAxis tick={{ fontSize: 9, fill: '#6b6b80', fontFamily: 'monospace' }} tickFormatter={(v: number) => `$${v}`} width={40} />
                  <rc.Tooltip
                    contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, fontSize: 10, fontFamily: 'monospace' }}
                    labelStyle={{ color: '#a855f7' }}
                  />
                  <rc.Area type="monotone" dataKey="revenue" stroke="#a855f7" fill="rgba(168,85,247,0.15)" strokeWidth={2} />
                </rc.AreaChart>
              </rc.ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Endpoint breakdown chart */}
        {rc && epData.length > 0 && (
          <Card>
            <div className="text-[8px] font-mono text-white/30 tracking-wider mb-3">REQUESTS BY ENDPOINT</div>
            <div className="h-40">
              <rc.ResponsiveContainer width="100%" height="100%">
                <rc.BarChart data={epData}>
                  <rc.XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b6b80', fontFamily: 'monospace' }} />
                  <rc.YAxis tick={{ fontSize: 9, fill: '#6b6b80', fontFamily: 'monospace' }} width={40} />
                  <rc.Tooltip
                    contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <rc.Bar dataKey="requests" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </rc.BarChart>
              </rc.ResponsiveContainer>
            </div>
          </Card>
        )}

        {data.totalRequests === 0 && (
          <Card>
            <div className="text-center py-4">
              <p className="text-[11px] text-white/30">No payment events recorded yet.</p>
              <p className="text-[9px] text-white/20 mt-1">Events are logged when callers pay for your x402 endpoints.</p>
            </div>
          </Card>
        )}
      </Section>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

type AgentTab = 'overview' | 'launch' | 'agent' | 'marketplace' | 'directory' | 'analytics' | 'docs';

export default function AgentsClient() {
  const [tab, setTab] = useState<AgentTab>('overview');
  const { address, isConnected } = useAccount();

  const chainSub = useAgoraAgentSub(address as `0x${string}` | undefined);
  const launchpad = useAgoraLaunchpad(address as `0x${string}` | undefined);

  // After subscribe confirms: auto-register subdomain in KV, then navigate to My Agent
  useEffect(() => {
    if (chainSub.isConfirmed && tab === 'launch' && chainSub.lastAction === 'subscribe') {
      chainSub.refetchAll();
      chainSub.reset();
      // Auto-register name in KV for subdomain resolution
      if (address && chainSub.agentName) {
        fetch('/api/agents/register-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: chainSub.agentName, address }),
        }).catch(() => {}); // best-effort, user can retry via Step 4
      }
      setTab('agent');
    }
    // After approve confirms, just refetch allowance so the button updates
    if (chainSub.isConfirmed && chainSub.lastAction === 'approve') {
      chainSub.refetchAll();
      chainSub.reset();
    }
  }, [chainSub.isConfirmed, tab, chainSub.lastAction]);

  // Refetch after launchpad tx confirms (token launch, endpoint registration, etc.)
  useEffect(() => {
    if (launchpad.isConfirmed && tab === 'launch') {
      launchpad.refetchAll();
      launchpad.reset();
    }
  }, [launchpad.isConfirmed, tab]);

  const TABS: { id: AgentTab; label: string }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'launch', label: 'LAUNCH' },
    { id: 'agent', label: 'MY AGENT' },
    { id: 'marketplace', label: 'MARKET' },
    { id: 'directory', label: 'DIRECTORY' },
    { id: 'analytics', label: 'ANALYTICS' },
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
          <p className="text-[11px] text-white/30 mt-1">Launch your x402 agent with a bonding curve token</p>
        </div>

        {/* Wallet status */}
        <div className="flex items-center justify-center gap-3">
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-mono tracking-wider transition-all whitespace-nowrap ${
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
            totalCurves={launchpad.totalCurves}
            onGetStarted={() => setTab('launch')}
          />
        )}
        {tab === 'launch' && (
          <LaunchTab
            isConnected={isConnected}
            chainSub={chainSub}
            launchpad={launchpad}
            onGoToAgent={() => setTab('agent')}
          />
        )}
        {tab === 'agent' && (
          <MyAgentTab
            isConnected={isConnected}
            chainSub={chainSub}
            launchpad={launchpad}
            onGoToLaunch={() => setTab('launch')}
          />
        )}
        {tab === 'marketplace' && <MarketplaceTab />}
        {tab === 'directory' && <DirectoryTab />}
        {tab === 'analytics' && (
          <AnalyticsTab isConnected={isConnected} address={address} chainSub={chainSub} />
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
