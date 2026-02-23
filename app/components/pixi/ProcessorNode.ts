// ProcessorNode.ts — Central server node, morphs with tier
import { Graphics, Container } from 'pixi.js';

const TIER_COLORS = [
  0x00ff44, 0x00ffaa, 0x00ccff, 0x0088ff, 0x4444ff, 0x8844ff, 0xcc44ff,
];

export class ProcessorNode extends Container {
  private core: Graphics;
  private pulseRing: Graphics;
  private phase = 0;
  private currentTier = 0;

  constructor(x: number, y: number) {
    super();
    this.position.set(x, y);

    this.pulseRing = new Graphics();
    this.addChild(this.pulseRing);

    this.core = new Graphics();
    this.addChild(this.core);

    this.drawTier(0);
  }

  drawTier(tier: number) {
    this.currentTier = tier;
    const color = TIER_COLORS[tier] ?? TIER_COLORS[0];
    const size = 12 + tier * 4;

    this.core.clear();

    if (tier <= 1) {
      // VPS/Cluster: single or 4-node squares
      const offset = tier === 0 ? 0 : 8;
      const positions = tier === 0
        ? [[0, 0]]
        : [[-offset, -offset], [offset, -offset], [-offset, offset], [offset, offset]];

      for (const [dx, dy] of positions) {
        this.core.roundRect(dx - 5, dy - 5, 10, 10, 2)
          .fill({ color, alpha: 0.8 });
        this.core.roundRect(dx - 5, dy - 5, 10, 10, 2)
          .stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
      }

      // Connection lines for cluster
      if (tier === 1) {
        this.core.setStrokeStyle({ width: 1, color, alpha: 0.4 });
        this.core.moveTo(-offset, -offset).lineTo(offset, -offset).stroke();
        this.core.moveTo(-offset, offset).lineTo(offset, offset).stroke();
        this.core.moveTo(-offset, -offset).lineTo(-offset, offset).stroke();
        this.core.moveTo(offset, -offset).lineTo(offset, offset).stroke();
      }
    } else {
      // Higher tiers: larger complex with multiple cores
      const coreCount = 2 + tier;
      const radius = size;
      for (let i = 0; i < coreCount; i++) {
        const angle = (i / coreCount) * Math.PI * 2 - Math.PI / 2;
        const cx = Math.cos(angle) * radius * 0.5;
        const cy = Math.sin(angle) * radius * 0.5;
        const nodeSize = 4 + tier;
        this.core.roundRect(cx - nodeSize / 2, cy - nodeSize / 2, nodeSize, nodeSize, 2)
          .fill({ color, alpha: 0.7 });
      }
      // Central hub
      this.core.circle(0, 0, 6 + tier)
        .fill({ color, alpha: 0.9 });
      this.core.circle(0, 0, 6 + tier)
        .stroke({ width: 1.5, color: 0xffffff, alpha: 0.4 });
    }
  }

  update(tier: number, dt: number) {
    if (tier !== this.currentTier) this.drawTier(tier);

    this.phase += dt * 2;
    const color = TIER_COLORS[tier] ?? TIER_COLORS[0];
    const pulseRadius = 20 + tier * 6 + Math.sin(this.phase) * 4;
    const alpha = 0.15 + Math.sin(this.phase) * 0.08;

    this.pulseRing.clear();
    this.pulseRing.circle(0, 0, pulseRadius)
      .stroke({ width: 1.5, color, alpha });
    if (tier >= 3) {
      this.pulseRing.circle(0, 0, pulseRadius + 8)
        .stroke({ width: 1, color, alpha: alpha * 0.5 });
    }
  }
}
