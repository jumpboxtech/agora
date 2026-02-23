// AgentSprite.ts — AI Agent animated entities
import { Graphics, Container } from 'pixi.js';

const AGENT_COLORS: Record<string, number> = {
  builder: 0x88aaff,
  optimizer: 0xffaa44,
  scout: 0x44ffaa,
  architect: 0xff88dd,
};

// Icons kept for reference; sprites use diamond shapes
// builder: 🔨, optimizer: 🔧, scout: 👁, architect: 📐

interface AgentInfo {
  id: string;
  status: 'available' | 'active' | 'idle';
}

export class AgentSprites extends Container {
  private gfx: Graphics;
  private centerX: number;
  private centerY: number;
  private phase = 0;

  constructor(centerX: number, centerY: number) {
    super();
    this.centerX = centerX;
    this.centerY = centerY;
    this.gfx = new Graphics();
    this.addChild(this.gfx);
  }

  update(agents: AgentInfo[], dt: number) {
    this.phase += dt;
    this.gfx.clear();

    const activeAgents = agents.filter((a) => a.status === 'active');
    if (activeAgents.length === 0) return;

    for (let i = 0; i < activeAgents.length; i++) {
      const agent = activeAgents[i];
      const color = AGENT_COLORS[agent.id] ?? 0xffffff;

      // Each agent follows a unique orbit path
      let ax: number, ay: number;

      switch (agent.id) {
        case 'builder': {
          // Travels in a figure-8 between center and edges
          const t = this.phase * 0.8;
          ax = this.centerX + Math.sin(t) * 50;
          ay = this.centerY + Math.sin(t * 2) * 25 + 30;
          break;
        }
        case 'optimizer': {
          // Orbits the processor
          const t = this.phase * 1.2;
          ax = this.centerX + Math.cos(t) * 35;
          ay = this.centerY + Math.sin(t) * 35;
          break;
        }
        case 'scout': {
          // Scans the perimeter
          const t = this.phase * 0.5;
          const r = 70 + Math.sin(t * 3) * 10;
          ax = this.centerX + Math.cos(t) * r;
          ay = this.centerY + Math.sin(t) * r * 0.6;
          break;
        }
        case 'architect': {
          // Hovers near the bottom API area
          const t = this.phase * 0.6;
          ax = this.centerX + Math.sin(t) * 40;
          ay = this.centerY + 50 + Math.sin(t * 1.5) * 10;
          break;
        }
        default:
          ax = this.centerX;
          ay = this.centerY;
      }

      // Agent body (small glowing diamond)
      const size = 4;
      const pulse = 0.7 + Math.sin(this.phase * 3 + i) * 0.2;

      this.gfx.moveTo(ax, ay - size)
        .lineTo(ax + size, ay)
        .lineTo(ax, ay + size)
        .lineTo(ax - size, ay)
        .closePath()
        .fill({ color, alpha: pulse });

      // Glow ring
      this.gfx.circle(ax, ay, size + 2)
        .stroke({ width: 0.5, color, alpha: pulse * 0.4 });
    }
  }
}
