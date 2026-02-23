// GridBackground.ts — Circuit board grid with tier-based color shifts
import { Graphics, Container } from 'pixi.js';

const TIER_COLORS = [
  0x00ff44, // VPS - green
  0x00ffaa, // Cluster - cyan-green
  0x00ccff, // Datacenter - cyan
  0x0088ff, // Regional - blue
  0x4444ff, // National - indigo
  0x8844ff, // Continental - purple
  0xcc44ff, // Global - magenta
];

export class GridBackground extends Container {
  private grid: Graphics;
  private pulsePhase = 0;
  private w: number;
  private h: number;

  constructor(width: number, height: number) {
    super();
    this.w = width;
    this.h = height;
    this.grid = new Graphics();
    this.addChild(this.grid);
    this.draw(0);
  }

  draw(tier: number) {
    const g = this.grid;
    g.clear();

    const color = TIER_COLORS[tier] ?? TIER_COLORS[0];
    const spacing = 30;

    // Grid lines
    g.setStrokeStyle({ width: 0.5, color, alpha: 0.08 });
    for (let x = 0; x <= this.w; x += spacing) {
      g.moveTo(x, 0).lineTo(x, this.h).stroke();
    }
    for (let y = 0; y <= this.h; y += spacing) {
      g.moveTo(0, y).lineTo(this.w, y).stroke();
    }

    // Intersection dots
    for (let x = 0; x <= this.w; x += spacing) {
      for (let y = 0; y <= this.h; y += spacing) {
        g.circle(x, y, 1).fill({ color, alpha: 0.15 });
      }
    }
  }

  update(tier: number, dt: number) {
    this.pulsePhase += dt * 0.5;
    // Subtle alpha pulse on the grid
    this.grid.alpha = 0.8 + Math.sin(this.pulsePhase) * 0.1;
    this.draw(tier);
  }
}
