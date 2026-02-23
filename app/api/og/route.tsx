import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const TIER_NAMES = ['VPS', 'CLUSTER', 'DATACENTER', 'REGIONAL', 'NATIONAL', 'CONTINENTAL', 'GLOBAL'];
const TIER_COLORS = ['#4ade80', '#22d3ee', '#3b82f6', '#a78bfa', '#f472b6', '#fb923c', '#facc15'];
const API_LABELS = ['PRC', 'SIG', 'REG', 'RTR', 'SCN', 'AI'];
const AGENT_LABELS = ['BLD', 'OPT', 'SCT', 'ARC'];
const AGENT_COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ec4899'];

function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// GET /api/og?tier=2&earned=1234.56&apis=3&agents=2&agora=50000&processed=25000
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams;
  const tier = Math.min(6, Math.max(0, Number(s.get('tier')) || 0));
  const earned = Number(s.get('earned')) || 0;
  const apis = Number(s.get('apis')) || 0;
  const agents = Number(s.get('agents')) || 0;
  const agora = Number(s.get('agora')) || 0;
  const processed = Number(s.get('processed')) || 0;

  const tierName = TIER_NAMES[tier];
  const tierColor = TIER_COLORS[tier];
  const procSize = 44 + tier * 6;

  // API nodes in semicircle (shifted right 50px from edge)
  const cx = 195, cy = 190, radius = 80;
  const apiNodes: { x: number; y: number; active: boolean; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI * 0.7 + (Math.PI * 1.4 * i) / 5;
    apiNodes.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, active: i < apis, label: API_LABELS[i] });
  }

  return new ImageResponse(
    (
      <div style={{ width: 800, height: 418, display: 'flex', fontFamily: 'monospace', color: 'white', background: '#0a0a12', padding: '0 50px' }}>
        {/* Grid bg */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 800, height: 418, display: 'flex', backgroundImage: 'linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        {/* Left: Infra viz */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 280, height: 418, position: 'relative' }}>
          {/* Connection lines */}
          {apiNodes.map((node, i) => (
            <div key={`c${i}`} style={{ position: 'absolute', top: Math.min(cy, node.y), left: Math.min(cx, node.x), width: Math.abs(node.x - cx) || 1, height: Math.abs(node.y - cy) || 1, display: 'flex', borderBottom: node.active ? '1px solid rgba(0,229,255,0.15)' : '1px solid rgba(255,255,255,0.03)', borderRight: node.active ? '1px solid rgba(0,229,255,0.15)' : '1px solid rgba(255,255,255,0.03)' }} />
          ))}

          {/* Processor */}
          <div style={{ position: 'absolute', top: cy - procSize / 2, left: cx - procSize / 2, width: procSize, height: procSize, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: procSize / 2, background: `radial-gradient(circle, ${tierColor}22 0%, transparent 70%)`, border: `2px solid ${tierColor}`, boxShadow: `0 0 20px ${tierColor}40` }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 8, color: tierColor, letterSpacing: 1, fontWeight: 700 }}>{tierName}</span>
            </div>
          </div>

          {/* API nodes */}
          {apiNodes.map((node, i) => (
            <div key={`a${i}`} style={{ position: 'absolute', top: node.y - 14, left: node.x - 14, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: node.active ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.02)', border: node.active ? '1px solid rgba(0,229,255,0.4)' : '1px solid rgba(255,255,255,0.05)', boxShadow: node.active ? '0 0 8px rgba(0,229,255,0.15)' : 'none' }}>
              <span style={{ fontSize: 6, color: node.active ? '#00E5FF' : 'rgba(255,255,255,0.12)', fontWeight: 600 }}>{node.label}</span>
            </div>
          ))}

          {/* Agents row */}
          <div style={{ position: 'absolute', bottom: 36, left: 0, width: 280, display: 'flex', justifyContent: 'center', gap: 10 }}>
            {AGENT_LABELS.map((label, i) => (
              <div key={`ag${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i < agents ? `${AGENT_COLORS[i]}20` : 'rgba(255,255,255,0.02)', border: i < agents ? `1px solid ${AGENT_COLORS[i]}80` : '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 9 }}>{i < agents ? '⚡' : '·'}</span>
                </div>
                <span style={{ fontSize: 5, color: i < agents ? AGENT_COLORS[i] : 'rgba(255,255,255,0.08)', letterSpacing: 1 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ position: 'absolute', top: 24, left: 330, width: 1, height: 370, display: 'flex', background: 'linear-gradient(180deg, transparent, rgba(0,229,255,0.12), transparent)' }} />

        {/* Right: Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '28px 32px' }}>
          {/* Title + tier */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: '#00E5FF', letterSpacing: 5 }}>AGORA</span>
            <div style={{ display: 'flex', alignItems: 'center', padding: '3px 10px', border: `1px solid ${tierColor}60`, borderRadius: 5, background: `${tierColor}10` }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: tierColor, marginRight: 6 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: tierColor, letterSpacing: 2 }}>{tierName}</span>
            </div>
          </div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: 2, marginTop: 2 }}>x402 INFRASTRUCTURE TYCOON</span>

          {/* Earned */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20, padding: '14px 16px', background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.1)', borderRadius: 8 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>TOTAL EARNED</span>
            <span style={{ fontSize: 32, fontWeight: 700, color: '#00E5FF', marginTop: 2 }}>{fmtUSD(earned)}</span>
          </div>

          {/* 2x2 stat grid */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '10px 12px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 6 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 1 }}>REQUESTS</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa', marginTop: 1 }}>{fmtNum(processed)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '10px 12px', background: 'rgba(250,204,21,0.04)', border: '1px solid rgba(250,204,21,0.1)', borderRadius: 6 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 1 }}>$AGORA</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#facc15', marginTop: 1 }}>{fmtNum(agora)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '10px 12px', background: 'rgba(0,229,255,0.03)', border: '1px solid rgba(0,229,255,0.07)', borderRadius: 6 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 1 }}>APIs</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#22d3ee', marginTop: 1 }}>{apis}/6</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '10px 12px', background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)', borderRadius: 6 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: 1 }}>AGENTS</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#c084fc', marginTop: 1 }}>{agents}/4</span>
            </div>
          </div>

          {/* URL */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: 2 }}>agora.jumpbox.tech</span>
          </div>
        </div>
      </div>
    ),
    { width: 800, height: 418 },
  );
}
