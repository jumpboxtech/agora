import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  // Donut chart segments (illustrative — OG images are cached by platforms)
  const segments = [
    { label: 'Circulating', pct: 55, color: '#00ff88' },
    { label: 'Staked', pct: 25, color: '#38bdf8' },
    { label: 'Burned', pct: 10, color: '#ff3366' },
    { label: 'Pool', pct: 10, color: '#ffaa00' },
  ];

  // Build SVG donut arcs
  const cx = 120, cy = 120, r = 80, inner = 50;
  let offset = 0;
  const arcs = segments.map(seg => {
    const angle = (seg.pct / 100) * 360;
    const startAngle = offset - 90;
    const endAngle = offset + angle - 90;
    offset += angle;

    const rad = Math.PI / 180;
    const x1 = cx + r * Math.cos(startAngle * rad);
    const y1 = cy + r * Math.sin(startAngle * rad);
    const x2 = cx + r * Math.cos(endAngle * rad);
    const y2 = cy + r * Math.sin(endAngle * rad);
    const ix1 = cx + inner * Math.cos(endAngle * rad);
    const iy1 = cy + inner * Math.sin(endAngle * rad);
    const ix2 = cx + inner * Math.cos(startAngle * rad);
    const iy2 = cy + inner * Math.sin(startAngle * rad);
    const large = angle > 180 ? 1 : 0;

    return `<path d="M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${inner},${inner} 0 ${large} 0 ${ix2},${iy2} Z" fill="${seg.color}" opacity="0.85"/>`;
  });

  const donutSvg = `<svg width="240" height="240" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">${arcs.join('')}</svg>`;
  const donutDataUri = `data:image/svg+xml,${encodeURIComponent(donutSvg)}`;

  return new ImageResponse(
    (
      <div style={{ width: 800, height: 418, display: 'flex', fontFamily: 'monospace', color: 'white', background: '#0a0a12', padding: '0 50px' }}>
        {/* Grid bg */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 800, height: 418, display: 'flex', backgroundImage: 'linear-gradient(rgba(0,255,136,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.02) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        {/* Left: Donut chart */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 320, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={donutDataUri} width={200} height={200} alt="" />
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, justifyContent: 'center' }}>
            {segments.map(seg => (
              <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: seg.color }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>{seg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ position: 'absolute', top: 24, left: 340, width: 1, height: 370, display: 'flex', background: 'linear-gradient(180deg, transparent, rgba(0,255,136,0.12), transparent)' }} />

        {/* Right: Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '28px 32px' }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: '#00ff88', letterSpacing: 5 }}>AGORA</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: 3, marginTop: 2 }}>PROTOCOL DASHBOARD</span>

          {/* Stat cards 2x2 */}
          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '12px 14px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>TOTAL STAKED</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>—</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '12px 14px', background: 'rgba(255,51,102,0.06)', border: '1px solid rgba(255,51,102,0.15)', borderRadius: 8 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>TOTAL BURNED</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#ff3366', marginTop: 2 }}>—</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '12px 14px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 8 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>ACTIVE AGENTS</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#a855f7', marginTop: 2 }}>—</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '12px 14px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 8 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>REWARD POOL</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#00ff88', marginTop: 2 }}>—</span>
            </div>
          </div>

          {/* Tagline */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 16, gap: 8 }}>
            <div style={{ height: 1, flex: 1, background: 'rgba(0,255,136,0.1)' }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: 2 }}>$AGORA ON BASE</span>
            <div style={{ height: 1, flex: 1, background: 'rgba(0,255,136,0.1)' }} />
          </div>

          {/* URL */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: 2 }}>agora.jumpbox.tech/stats</span>
          </div>
        </div>
      </div>
    ),
    { width: 800, height: 418 },
  );
}
