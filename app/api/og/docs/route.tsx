import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const PILLS = ['x402 Tycoon', '$AGORA Token', 'Base Mainnet'];
const SECTIONS = ['Game Mechanics', 'Tokenomics', 'Smart Contracts', 'Staking Guide'];

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: 800, height: 418, display: 'flex', flexDirection: 'column', fontFamily: 'monospace', color: 'white', background: '#0a0a12', padding: '48px 60px', position: 'relative' }}>
        {/* Grid bg */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 800, height: 418, display: 'flex', backgroundImage: 'linear-gradient(rgba(0,255,136,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.02) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: '#00ff88', letterSpacing: 6 }}>AGORA</span>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', letterSpacing: 5, marginTop: 4 }}>DOCUMENTATION</span>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', width: '100%', height: 1, background: 'linear-gradient(90deg, #00ff88, transparent)', marginTop: 24, marginBottom: 24 }} />

        {/* Pills */}
        <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
          {PILLS.map(pill => (
            <div key={pill} style={{ display: 'flex', padding: '6px 16px', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 20, background: 'rgba(0,255,136,0.06)' }}>
              <span style={{ fontSize: 12, color: '#00ff88', letterSpacing: 1, fontWeight: 600 }}>{pill}</span>
            </div>
          ))}
        </div>

        {/* Sections preview */}
        <div style={{ display: 'flex', gap: 10, marginTop: 32, position: 'relative' }}>
          {SECTIONS.map((sec, i) => (
            <div key={sec} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.1)' }}>•</span>}
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>{sec}</span>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', position: 'relative' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: 2 }}>x402 INFRASTRUCTURE TYCOON</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: 2 }}>agora.jumpbox.tech/docs</span>
        </div>
      </div>
    ),
    { width: 800, height: 418 },
  );
}
