'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useProtocolStats, weiToNumber } from '../lib/useProtocolStats';
import { formatTokenAmount } from '../lib/useAgoraStaking';
import type { LeaderboardEntry } from '../lib/leaderboard';

// ─── Theme ──────────────────────────────────────────────────────────────────

const COLORS = {
  accent: '#00ff88',
  danger: '#ff3366',
  warn: '#ffaa00',
  info: '#38bdf8',
  purple: '#a855f7',
  muted: '#6b6b80',
  grid: 'rgba(255,255,255,0.05)',
  tooltipBg: '#111126',
  tooltipBorder: 'rgba(0,255,136,0.2)',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function CyberTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload?: { fill?: string } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg border backdrop-blur-md" style={{ background: COLORS.tooltipBg, borderColor: COLORS.tooltipBorder }}>
      <p className="text-[10px] font-mono" style={{ color: COLORS.muted }}>{payload[0].name}</p>
      <p className="text-sm font-mono font-bold" style={{ color: payload[0].payload?.fill || COLORS.accent }}>
        {formatLargeNumber(payload[0].value)}
      </p>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="p-3 rounded-xl bg-surface-card border border-white/5 hover:border-white/10 transition-all">
      <div className="text-[8px] font-mono tracking-wider mb-1" style={{ color: COLORS.muted }}>{label}</div>
      <div className="ticker text-lg font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[8px] font-mono mt-0.5" style={{ color: COLORS.muted }}>{sub}</div>}
    </div>
  );
}

// ─── Leaderboard Table ──────────────────────────────────────────────────────

function LeaderboardTable({ entries, type }: { entries: LeaderboardEntry[]; type: 'stakers' | 'burners' }) {
  const color = type === 'stakers' ? COLORS.info : COLORS.danger;
  const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-white/20 text-[10px] font-mono">
        No {type} found yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry, i) => (
        <div
          key={entry.address}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/5 hover:border-white/10 transition-all"
          style={{ background: i < 3 ? `${rankColors[i]}08` : 'transparent' }}
        >
          <span
            className="w-6 text-center text-[10px] font-mono font-bold"
            style={{ color: i < 3 ? rankColors[i] : COLORS.muted }}
          >
            #{i + 1}
          </span>
          <span className="flex-1 text-[10px] font-mono text-white/60">{truncAddr(entry.address)}</span>
          <span className="text-[10px] font-mono font-bold" style={{ color }}>
            {formatLargeNumber(Number(entry.amount))}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Pie Label ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;
  if (!percent || percent < 0.03) return null;
  const RADIAN = Math.PI / 180;
  const radius = (innerRadius || 0) + ((outerRadius || 0) - (innerRadius || 0)) * 1.4;
  const x = (cx || 0) + radius * Math.cos(-(midAngle || 0) * RADIAN);
  const y = (cy || 0) + radius * Math.sin(-(midAngle || 0) * RADIAN);
  return (
    <text x={x} y={y} fill="#e8e8ef" textAnchor={x > (cx || 0) ? 'start' : 'end'} dominantBaseline="central"
      style={{ fontSize: '10px', fontFamily: 'var(--font-jetbrains)' }}
    >
      {name} {(percent * 100).toFixed(0)}%
    </text>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function StatsClient() {
  const stats = useProtocolStats();
  const [lbTab, setLbTab] = useState<'stakers' | 'burners'>('stakers');

  const { data: leaderboard, isLoading: lbLoading, isError: lbError } = useQuery<{ stakers: LeaderboardEntry[]; burners: LeaderboardEntry[] }>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const r = await fetch('/api/leaderboard');
      if (!r.ok) throw new Error('Failed to fetch');
      return r.json();
    },
    refetchInterval: 60_000,
    retry: 1,
  });

  // Chart data
  // Tokenomics allocation (100B total supply)
  const tokenomicsData = [
    { name: 'Staking Rewards', value: 40, fill: COLORS.info },
    { name: 'Community Rewards', value: 25, fill: COLORS.accent },
    { name: 'Expansion / Future', value: 20, fill: COLORS.purple },
    { name: 'Gameplay Rewards', value: 15, fill: COLORS.warn },
  ];

  const pieData = [
    { name: 'Circulating', value: weiToNumber(stats.circulating), fill: COLORS.accent },
    { name: 'Staked', value: weiToNumber(stats.stakingLocked), fill: COLORS.info },
    { name: 'Burned', value: weiToNumber(stats.totalBurnedAll), fill: COLORS.danger },
    { name: 'Reward Pool', value: weiToNumber(stats.rewardPoolActual), fill: COLORS.warn },
  ].filter(d => d.value > 0);

  const barData = [
    { name: 'Staked', value: weiToNumber(stats.totalStaked), fill: COLORS.info },
    { name: 'Staking Burns', value: weiToNumber(stats.stakingBurned), fill: COLORS.danger },
    { name: 'Sub Burns', value: weiToNumber(stats.subBurned), fill: COLORS.purple },
    { name: 'Distributed', value: weiToNumber(stats.totalDistributed), fill: COLORS.warn },
    { name: 'Pool', value: weiToNumber(stats.poolBalance), fill: COLORS.accent },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-surface relative overflow-auto">
      {/* Overlays */}
      <div className="scanline" />
      <div className="noise" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-[9px] font-mono tracking-[0.3em] text-accent/60 mb-1">$AGORA ON BASE</div>
          <h1 className="text-2xl font-bold tracking-tight text-white">PROTOCOL DASHBOARD</h1>
          <p className="text-[11px] text-white/30 mt-1">Real-time on-chain metrics and leaderboard</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <StatCard label="TOTAL STAKED" value={formatTokenAmount(stats.totalStaked)} color={COLORS.info} />
          <StatCard label="TOTAL BURNED" value={formatTokenAmount(stats.totalBurnedAll)} color={COLORS.danger} />
          <StatCard label="ACTIVE AGENTS" value={String(stats.activeSubscriptions)} color={COLORS.purple} />
          <StatCard label="DISTRIBUTED" value={formatTokenAmount(stats.totalDistributed)} color={COLORS.warn} />
          <StatCard label="REWARD POOL" value={formatTokenAmount(stats.poolBalance)} color={COLORS.accent} />
          <StatCard label="TOTAL CLAIMS" value={stats.totalClaims.toLocaleString()} color={COLORS.info} sub={`${formatTokenAmount(stats.totalCommitted)} committed`} />
        </div>

        {/* Token supply bar */}
        <div className="p-3 rounded-xl bg-surface-card border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-mono tracking-wider" style={{ color: COLORS.muted }}>TOTAL SUPPLY</span>
            <span className="ticker text-sm font-bold text-white/80">{formatTokenAmount(stats.totalSupply)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
            {pieData.map(d => {
              const total = weiToNumber(stats.totalSupply);
              const pct = total > 0 ? (d.value / total) * 100 : 0;
              return (
                <div
                  key={d.name}
                  className="h-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: d.fill, opacity: 0.8 }}
                  title={`${d.name}: ${pct.toFixed(1)}%`}
                />
              );
            })}
          </div>
          <div className="flex gap-3 mt-1.5">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: d.fill }} />
                <span className="text-[7px] font-mono text-white/30">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tokenomics Allocation */}
        <div className="p-3 rounded-xl bg-surface-card border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-mono tracking-wider" style={{ color: COLORS.muted }}>TOKENOMICS — 100B $AGORA</span>
            <span className="text-[7px] font-mono text-white/15">90B drip over 90 days</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={tokenomicsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {tokenomicsData.map(d => (
                    <Cell key={d.name} fill={d.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CyberTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {tokenomicsData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                  <span className="flex-1 text-[10px] font-mono text-white/50">{d.name}</span>
                  <span className="text-[10px] font-mono font-bold" style={{ color: d.fill }}>
                    {d.value}B ({d.value}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts — side by side on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pie Chart */}
          <div className="p-3 rounded-xl bg-surface-card border border-white/5">
            <div className="text-[8px] font-mono tracking-wider mb-2" style={{ color: COLORS.muted }}>TOKEN DISTRIBUTION</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {pieData.map(d => (
                    <Cell key={d.name} fill={d.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CyberTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div className="p-3 rounded-xl bg-surface-card border border-white/5">
            <div className="text-[8px] font-mono tracking-wider mb-2" style={{ color: COLORS.muted }}>PROTOCOL BREAKDOWN</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 8, fill: COLORS.muted, fontFamily: 'var(--font-jetbrains)' }}
                  axisLine={{ stroke: COLORS.grid }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 8, fill: COLORS.muted, fontFamily: 'var(--font-jetbrains)' }}
                  axisLine={{ stroke: COLORS.grid }}
                  tickLine={false}
                  tickFormatter={(v: number) => formatLargeNumber(v)}
                />
                <Tooltip content={<CyberTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map(d => (
                    <Cell key={d.name} fill={d.fill} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="p-3 rounded-xl bg-surface-card border border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setLbTab('stakers')}
              className={`px-3 py-1 rounded-lg text-[9px] font-mono tracking-wider transition-all ${
                lbTab === 'stakers' ? 'bg-info/15 text-info border border-info/30' : 'text-white/25 border border-white/5 hover:text-white/40'
              }`}
            >
              TOP STAKERS
            </button>
            <button
              onClick={() => setLbTab('burners')}
              className={`px-3 py-1 rounded-lg text-[9px] font-mono tracking-wider transition-all ${
                lbTab === 'burners' ? 'bg-danger/15 text-danger border border-danger/30' : 'text-white/25 border border-white/5 hover:text-white/40'
              }`}
            >
              TOP BURNERS
            </button>
            <div className="flex-1" />
            <span className="text-[7px] font-mono text-white/15">Updates every 5 min</span>
          </div>

          {lbLoading ? (
            <div className="text-center py-8 text-white/20 text-[10px] font-mono animate-pulse">Loading leaderboard...</div>
          ) : lbError ? (
            <div className="text-center py-8 text-white/20 text-[10px] font-mono">No activity yet — leaderboard populates after first stake or burn</div>
          ) : (
            <LeaderboardTable
              entries={lbTab === 'stakers' ? (leaderboard?.stakers ?? []) : (leaderboard?.burners ?? [])}
              type={lbTab}
            />
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <Link href="/" className="text-[10px] font-mono text-accent/50 hover:text-accent transition-colors">
            BACK TO AGORA
          </Link>
          <div className="text-[8px] font-mono text-white/10 mt-1">
            Data sourced from Base mainnet
          </div>
        </div>
      </div>
    </div>
  );
}
