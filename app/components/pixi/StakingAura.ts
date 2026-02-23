// StakingAura.ts — Concentric ring aura around processor based on staking
import { Graphics, Container } from 'pixi.js';

const AURA_COLORS = [
  0x44ff88, // tier 1: green
  0x44ddff, // tier 2: cyan
  0x8888ff, // tier 3: blue
  0xff88dd, // tier 4: purple
];

export class StakingAura extends Container {
  private rings: Graphics;
  private centerX: number;
  private centerY: number;
  private phase = 0;

  constructor(centerX: number, centerY: number) {
    super();
    this.centerX = centerX;
    this.centerY = centerY;
    this.rings = new Graphics();
    this.addChild(this.rings);
  }

  update(stakeTier: number, dt: number) {
    this.phase += dt * 0.8;
    this.rings.clear();

    if (stakeTier <= 0) return;

    const ringCount = stakeTier;
    const baseRadius = 30;
    const spacing = 12;

    for (let i = 0; i < ringCount; i++) {
      const radius = baseRadius + i * spacing + Math.sin(this.phase + i * 0.5) * 2;
      const alpha = (0.2 - i * 0.03) + Math.sin(this.phase + i) * 0.05;
      const color = AURA_COLORS[i] ?? AURA_COLORS[0];

      this.rings.circle(this.centerX, this.centerY, radius)
        .stroke({ width: 1.5, color, alpha: Math.max(0.05, alpha) });
    }
  }
}
