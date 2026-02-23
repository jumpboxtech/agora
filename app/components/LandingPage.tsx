'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ─── Data ───────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: '📊', title: 'Deploy APIs', desc: 'Build x402 payment endpoints that generate revenue per request', accent: '#00ff88' },
  { icon: '🤖', title: 'Hire AI Agents', desc: 'Autonomous workers that build, optimize, and scout opportunities', accent: '#38bdf8' },
  { icon: '💎', title: 'Stake $AGORA', desc: 'On-chain staking on Base for revenue multipliers up to +50%', accent: '#a855f7' },
  { icon: '🔥', title: 'Burn to Boost', desc: 'Permanently burn tokens for permanent infrastructure upgrades', accent: '#ff3366' },
];

const TIERS = ['VPS', 'CLUSTER', 'DATACENTER', 'REGIONAL', 'NATIONAL', 'CONTINENTAL', 'GLOBAL'];
const TIER_COLORS = ['#4ade80', '#22d3ee', '#3b82f6', '#a78bfa', '#f472b6', '#fb923c', '#facc15'];

const TERMINAL_LINES = [
  '> initializing x402 protocol...',
  '> deploying payment router ████████ 100%',
  '> agent_builder online',
  '> agent_scout scanning opportunities...',
  '> staking pool: 40B $AGORA allocated',
  '> burn engine: active',
  '> system ready. awaiting operator.',
];

// ─── Floating Particles ─────────────────────────────────────────────────────

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="landing-particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${8 + Math.random() * 12}s`,
            animationDelay: `${Math.random() * 10}s`,
            opacity: 0.3 + Math.random() * 0.5,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            boxShadow: `0 0 ${4 + Math.random() * 6}px rgba(0,255,136,${0.2 + Math.random() * 0.3})`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated Network Graph (SVG) ───────────────────────────────────────────

function NetworkGraph() {
  // 6 nodes in a hexagonal layout around center
  const cx = 160, cy = 140;
  const nodes = Array.from({ length: 6 }).map((_, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const r = 80 + (i % 2) * 20;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, active: i < 4 };
  });

  return (
    <svg width="320" height="280" viewBox="0 0 320 280" className="mx-auto opacity-60">
      {/* Connection lines with animated dash */}
      {nodes.map((node, i) => (
        <line
          key={`l${i}`}
          x1={cx} y1={cy} x2={node.x} y2={node.y}
          stroke={node.active ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.03)'}
          strokeWidth={1}
          strokeDasharray={node.active ? '4 4' : '2 6'}
          style={node.active ? { animation: 'dash-scroll 3s linear infinite' } : {}}
        />
      ))}
      {/* Cross-connections */}
      {nodes.map((node, i) => {
        const next = nodes[(i + 1) % nodes.length];
        return (
          <line
            key={`c${i}`}
            x1={node.x} y1={node.y} x2={next.x} y2={next.y}
            stroke={node.active && next.active ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.02)'}
            strokeWidth={0.5}
          />
        );
      })}
      {/* Center processor — pulsing */}
      <circle cx={cx} cy={cy} r={24} fill="rgba(0,255,136,0.05)" stroke="#00ff88" strokeWidth={1.5} opacity={0.8}>
        <animate attributeName="r" values="22;26;22" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={36} fill="none" stroke="rgba(0,255,136,0.1)" strokeWidth={0.5}>
        <animate attributeName="r" values="34;40;34" dur="4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="4s" repeatCount="indefinite" />
      </circle>
      <text x={cx} y={cy + 3} textAnchor="middle" fill="#00ff88" fontSize="7" fontFamily="monospace" fontWeight="700" letterSpacing="1">CORE</text>
      {/* Outer nodes */}
      {nodes.map((node, i) => (
        <g key={`n${i}`}>
          <circle cx={node.x} cy={node.y} r={12} fill={node.active ? 'rgba(0,255,136,0.06)' : 'rgba(255,255,255,0.01)'} stroke={node.active ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.05)'} strokeWidth={0.8} />
          {node.active && (
            <circle cx={node.x} cy={node.y} r={3} fill="#00ff88" opacity={0.6}>
              <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
            </circle>
          )}
          <text x={node.x} y={node.y + 3} textAnchor="middle" fill={node.active ? 'rgba(0,255,136,0.5)' : 'rgba(255,255,255,0.08)'} fontSize="5" fontFamily="monospace">
            {['PRC', 'SIG', 'REG', 'RTR', 'SCN', 'AI'][i]}
          </text>
        </g>
      ))}
      {/* Data packets flowing along connections */}
      {nodes.filter(n => n.active).map((node, i) => (
        <circle key={`p${i}`} r={1.5} fill="#00ff88" opacity={0.8}>
          <animateMotion dur={`${2 + i}s`} repeatCount="indefinite" path={`M${cx},${cy} L${node.x},${node.y}`} />
          <animate attributeName="opacity" values="0;1;1;0" dur={`${2 + i}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

// ─── Terminal Window ────────────────────────────────────────────────────────

function Terminal() {
  const [visibleLines, setVisibleLines] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setVisibleLines(prev => {
        if (prev >= TERMINAL_LINES.length) {
          // Reset after a pause
          setTimeout(() => setVisibleLines(0), 2000);
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 600);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Restart cycle
  useEffect(() => {
    if (visibleLines === 0) {
      const timer = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          setVisibleLines(prev => {
            if (prev >= TERMINAL_LINES.length) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              setTimeout(() => setVisibleLines(0), 3000);
              return prev;
            }
            return prev + 1;
          });
        }, 600);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [visibleLines]);

  return (
    <div className="p-3 rounded-xl bg-[#080814] border border-accent/10 font-mono text-[9px] leading-relaxed overflow-hidden" style={{ minHeight: 140 }}>
      <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/5">
        <div className="w-2 h-2 rounded-full bg-danger/60" />
        <div className="w-2 h-2 rounded-full bg-warn/60" />
        <div className="w-2 h-2 rounded-full bg-accent/60" />
        <span className="text-white/10 ml-2 text-[7px]">agora-protocol</span>
      </div>
      {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
        <div key={i} className="text-accent/60" style={{ animationDelay: `${i * 0.1}s` }}>
          {line}
        </div>
      ))}
      {visibleLines < TERMINAL_LINES.length && visibleLines > 0 && (
        <span className="terminal-cursor" />
      )}
      {visibleLines >= TERMINAL_LINES.length && (
        <div className="text-accent mt-1 font-bold">
          {'>'} <span className="terminal-cursor" />
        </div>
      )}
    </div>
  );
}

// ─── Stats Ticker ───────────────────────────────────────────────────────────

function StatsTicker() {
  const stats = [
    { label: 'SUPPLY', value: '100B', color: '#00ff88' },
    { label: 'CHAIN', value: 'BASE', color: '#38bdf8' },
    { label: 'TIERS', value: '7', color: '#a855f7' },
    { label: 'APIs', value: '6', color: '#22d3ee' },
    { label: 'AGENTS', value: '4', color: '#f472b6' },
    { label: 'PROTOCOL', value: 'x402', color: '#ffaa00' },
  ];

  return (
    <div className="overflow-hidden py-2 border-y border-white/5">
      <div className="flex gap-8 animate-[slide-in_20s_linear_infinite]" style={{ width: 'max-content' }}>
        {[...stats, ...stats, ...stats].map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[7px] font-mono text-white/15">{s.label}</span>
            <span className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Landing ───────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] w-full bg-surface relative overflow-auto">
      <div className="scanline" />
      <div className="noise" />
      <div className="landing-hex-grid" />
      <Particles />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4 pt-6">
          <div className="text-[8px] font-mono tracking-[0.5em] text-accent/30 animate-pulse">FARCASTER MINI APP</div>

          {/* Glowing title */}
          <div className="relative inline-block">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-accent" style={{ textShadow: '0 0 40px rgba(0,255,136,0.4), 0 0 80px rgba(0,255,136,0.15)' }}>
              AGORA
            </h1>
            {/* Underline glow */}
            <div className="h-[1px] w-full mt-1" style={{ background: 'linear-gradient(90deg, transparent, #00ff88, transparent)' }} />
          </div>

          <p className="text-base sm:text-lg text-white/35 font-light tracking-wide">x402 Infrastructure Tycoon</p>
          <p className="text-[10px] text-white/20 max-w-sm mx-auto leading-relaxed font-mono">
            Build autonomous payment infrastructure. Deploy APIs, hire AI agents, stake $AGORA on Base.
          </p>

          {/* CTA */}
          <div className="pt-4 flex flex-col items-center gap-3">
            <a
              href="https://farcaster.xyz/miniapps/uImosYfPQ7Hl/agora"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-2 px-8 py-3.5 rounded-xl btn-approve text-sm font-bold tracking-widest"
            >
              {/* Button glow ring */}
              <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ boxShadow: '0 0 30px rgba(0,255,136,0.3), inset 0 0 30px rgba(0,255,136,0.1)' }} />
              <span className="relative">PLAY ON FARCASTER</span>
            </a>
            <span className="text-[7px] font-mono text-white/10">Open in Warpcast to play</span>
          </div>
        </div>

        {/* Network visualization */}
        <div className="relative">
          <NetworkGraph />
          <div className="absolute inset-x-0 bottom-0 h-16" style={{ background: 'linear-gradient(transparent, #0a0a12)' }} />
        </div>

        {/* Stats ticker */}
        <StatsTicker />

        {/* Tier progression */}
        <div className="space-y-3">
          <div className="text-[8px] font-mono tracking-[0.3em] text-white/15 text-center">INFRASTRUCTURE TIERS</div>
          <div className="flex items-center justify-center gap-1.5">
            {TIERS.map((name, i) => (
              <div key={name} className="flex flex-col items-center gap-1.5 group">
                <div
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center transition-all group-hover:scale-110"
                  style={{
                    borderColor: `${TIER_COLORS[i]}30`,
                    background: `${TIER_COLORS[i]}08`,
                    boxShadow: `0 0 12px ${TIER_COLORS[i]}10`,
                  }}
                >
                  <span className="text-[7px] sm:text-[8px] font-mono font-bold" style={{ color: TIER_COLORS[i] }}>T{i}</span>
                </div>
                <span className="text-[5px] sm:text-[6px] font-mono tracking-wider" style={{ color: `${TIER_COLORS[i]}60` }}>{name}</span>
              </div>
            ))}
          </div>
          {/* Progression line */}
          <div className="flex items-center justify-center px-8">
            <div className="h-[1px] w-full max-w-xs" style={{ background: 'linear-gradient(90deg, #4ade80, #22d3ee, #3b82f6, #a78bfa, #f472b6, #fb923c, #facc15)' }} />
          </div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="relative p-4 rounded-xl bg-surface-card border border-white/5 hover:border-white/15 transition-all group overflow-hidden"
            >
              {/* Corner accent */}
              <div className="absolute top-0 right-0 w-12 h-12 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(circle at top right, ${f.accent}15, transparent 70%)` }} />
              {/* Number index */}
              <div className="absolute top-2 right-3 text-[7px] font-mono font-bold" style={{ color: `${f.accent}20` }}>0{i + 1}</div>
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="text-sm font-bold text-white/80 group-hover:text-white transition-colors">{f.title}</h3>
              <p className="text-[10px] font-mono text-white/25 mt-1 leading-relaxed">{f.desc}</p>
              {/* Bottom accent line */}
              <div className="absolute bottom-0 left-4 right-4 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, transparent, ${f.accent}40, transparent)` }} />
            </div>
          ))}
        </div>

        {/* Terminal + Tokenomics side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Terminal */}
          <div>
            <div className="text-[8px] font-mono tracking-[0.3em] text-white/15 mb-2">PROTOCOL STATUS</div>
            <Terminal />
          </div>

          {/* Tokenomics */}
          <div>
            <div className="text-[8px] font-mono tracking-[0.3em] text-white/15 mb-2">TOKENOMICS — 100B $AGORA</div>
            <div className="p-3 rounded-xl bg-surface-card border border-white/5 space-y-3" style={{ minHeight: 140 }}>
              <div className="h-3 rounded-full bg-white/5 overflow-hidden flex">
                <div className="h-full" style={{ width: '40%', background: '#38bdf8', opacity: 0.8 }} />
                <div className="h-full" style={{ width: '25%', background: '#00ff88', opacity: 0.8 }} />
                <div className="h-full" style={{ width: '20%', background: '#a855f7', opacity: 0.8 }} />
                <div className="h-full" style={{ width: '15%', background: '#ffaa00', opacity: 0.8 }} />
              </div>
              <div className="space-y-1.5">
                {[
                  { name: 'Staking Rewards', pct: '40%', amount: '40B', color: '#38bdf8' },
                  { name: 'Community', pct: '25%', amount: '25B', color: '#00ff88' },
                  { name: 'Expansion', pct: '20%', amount: '20B', color: '#a855f7' },
                  { name: 'Gameplay', pct: '15%', amount: '15B', color: '#ffaa00' },
                ].map(t => (
                  <div key={t.name} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="flex-1 text-[8px] font-mono text-white/30">{t.name}</span>
                    <span className="text-[8px] font-mono font-bold" style={{ color: t.color }}>{t.amount}</span>
                  </div>
                ))}
              </div>
              <div className="text-[7px] font-mono text-white/10">90B drip over 90 days · ~1B / day</div>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center justify-center gap-6">
          <Link href="/stats" className="text-[10px] font-mono text-accent/40 hover:text-accent transition-colors tracking-wider">
            PROTOCOL DASHBOARD
          </Link>
          <div className="w-1 h-1 rounded-full bg-white/10" />
          <Link href="/docs" className="text-[10px] font-mono text-accent/40 hover:text-accent transition-colors tracking-wider">
            DOCUMENTATION
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center space-y-3 pb-6">
          <div className="h-[1px] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }} />
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://basescan.org/address/0x1Ea0cdA49E07BCFa88e79178eE07Db377a69E131"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[7px] font-mono text-white/15 hover:text-accent/40 transition-colors tracking-wider"
            >
              TOKEN CONTRACT
            </a>
            <div className="w-0.5 h-0.5 rounded-full bg-white/10" />
            <a
              href="https://basescan.org/address/0x2948e4CC6F368DFC34990F90B2cc7750E68Ef3B3"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[7px] font-mono text-white/15 hover:text-accent/40 transition-colors tracking-wider"
            >
              STAKING CONTRACT
            </a>
          </div>
          <div className="text-[7px] font-mono text-white/8">
            Built by <a href="https://jumpbox.tech" target="_blank" rel="noopener noreferrer" className="hover:text-white/15 transition-colors">Jumpbox</a> · $AGORA on Base
          </div>
        </div>
      </div>
    </div>
  );
}
