// ApiNode.ts — API endpoint satellite nodes with circuit trace connections
import { Graphics, Container } from 'pixi.js';

const API_COLORS: Record<string, number> = {
  token_price: 0x44ff88,
  signal_score: 0x44ddff,
  agent_registry: 0xff8844,
  payment_router: 0xffdd44,
  curve_scanner: 0x44ffdd,
  ai_orchestrator: 0xff44aa,
};

interface ApiNodeInfo {
  id: string;
  status: 'locked' | 'available' | 'building' | 'active';
  buildProgress: number;
  x: number;
  y: number;
}

export class ApiNodes extends Container {
  private nodes: Graphics;
  private traces: Graphics;
  private centerX: number;
  private centerY: number;
  private phase = 0;

  constructor(centerX: number, centerY: number) {
    super();
    this.centerX = centerX;
    this.centerY = centerY;
    this.traces = new Graphics();
    this.nodes = new Graphics();
    this.addChild(this.traces);
    this.addChild(this.nodes);
  }

  update(apis: ApiNodeInfo[], dt: number) {
    this.phase += dt * 1.5;
    this.nodes.clear();
    this.traces.clear();

    const radius = 80;
    const total = apis.length;

    for (let i = 0; i < total; i++) {
      const api = apis[i];
      const angle = (i / total) * Math.PI + Math.PI; // semicircle below center
      const nx = this.centerX + Math.cos(angle) * radius;
      const ny = this.centerY + Math.sin(angle) * radius * 0.7;
      api.x = nx;
      api.y = ny;

      const color = API_COLORS[api.id] ?? 0x888888;

      if (api.status === 'locked') {
        // Dim outline
        this.nodes.circle(nx, ny, 5)
          .stroke({ width: 0.5, color, alpha: 0.15 });
      } else if (api.status === 'available') {
        // Brighter outline
        this.nodes.circle(nx, ny, 5)
          .stroke({ width: 1, color, alpha: 0.3 });
      } else if (api.status === 'building') {
        // Pulsing progress ring
        const progressAngle = api.buildProgress * Math.PI * 2;
        this.nodes.circle(nx, ny, 5)
          .fill({ color, alpha: 0.2 });
        // Progress arc
        this.nodes.arc(nx, ny, 7, -Math.PI / 2, -Math.PI / 2 + progressAngle)
          .stroke({ width: 2, color, alpha: 0.7 });
        // Circuit trace (dotted while building)
        this.traces.setStrokeStyle({ width: 0.5, color, alpha: 0.2 });
        this.traces.moveTo(this.centerX, this.centerY).lineTo(nx, ny).stroke();
      } else if (api.status === 'active') {
        // Glowing node
        const glow = 0.6 + Math.sin(this.phase + i) * 0.2;
        this.nodes.circle(nx, ny, 6)
          .fill({ color, alpha: glow });
        this.nodes.circle(nx, ny, 6)
          .stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
        // Circuit trace
        this.traces.setStrokeStyle({ width: 1, color, alpha: 0.3 });
        this.traces.moveTo(this.centerX, this.centerY).lineTo(nx, ny).stroke();
        // Mini revenue particles (small dots along the trace)
        const particlePos = (this.phase * 0.3 + i * 0.5) % 1;
        const px = nx + (this.centerX - nx) * particlePos;
        const py = ny + (this.centerY - ny) * particlePos;
        this.nodes.circle(px, py, 1.5)
          .fill({ color, alpha: 0.6 });
      }
    }
  }
}
