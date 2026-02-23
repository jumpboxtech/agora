// DataStream.ts — Particle system for incoming x402 request flow
import { Graphics, Container } from 'pixi.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  alpha: number;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 150;
const COLORS = {
  valid: 0x00ff88,   // green
  invalid: 0xff4444, // red
  missed: 0xffaa00,  // yellow
};

export class DataStream extends Container {
  private particles: Particle[] = [];
  private gfx: Graphics;
  private centerX: number;
  private centerY: number;
  private w: number;
  private h: number;
  private spawnAccum = 0;

  constructor(width: number, height: number, centerX: number, centerY: number) {
    super();
    this.w = width;
    this.h = height;
    this.centerX = centerX;
    this.centerY = centerY;
    this.gfx = new Graphics();
    this.addChild(this.gfx);
  }

  update(rps: number, accuracy: number, dt: number) {
    // Spawn rate based on RPS (visual particles, not 1:1 with actual)
    const spawnRate = Math.min(30, rps * 0.5);
    this.spawnAccum += spawnRate * dt;

    while (this.spawnAccum >= 1 && this.particles.length < MAX_PARTICLES) {
      this.spawnAccum -= 1;
      this.spawnParticle(accuracy);
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Move toward center with bezier-like curve
      const dx = this.centerX - p.x;
      const dy = this.centerY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = 80 + (1 - p.life / p.maxLife) * 120;

      if (dist > 3) {
        p.x += (dx / dist) * speed * dt + p.vx * dt;
        p.y += (dy / dist) * speed * dt + p.vy * dt;
        // Dampen lateral velocity
        p.vx *= 0.96;
        p.vy *= 0.96;
      }

      // Fade out near end of life
      p.alpha = Math.min(1, p.life / (p.maxLife * 0.3));

      // Invalid particles that are "caught" bounce off
      if (p.color === COLORS.invalid && dist < 30) {
        p.vx = -dx * 2;
        p.vy = -dy * 2;
        p.color = COLORS.invalid;
        p.life = Math.min(p.life, 0.3);
      }
    }

    // Redraw
    this.gfx.clear();
    for (const p of this.particles) {
      const size = 2 + (p.life / p.maxLife);
      this.gfx.circle(p.x, p.y, size)
        .fill({ color: p.color, alpha: p.alpha * 0.8 });
    }
  }

  private spawnParticle(accuracy: number) {
    // Random edge position
    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    switch (edge) {
      case 0: x = Math.random() * this.w; y = -5; break;         // top
      case 1: x = this.w + 5; y = Math.random() * this.h; break; // right
      case 2: x = Math.random() * this.w; y = this.h + 5; break; // bottom
      case 3: x = -5; y = Math.random() * this.h; break;         // left
    }

    const isInvalid = Math.random() < 0.25;
    const isCaught = isInvalid && Math.random() < accuracy;
    const color = isInvalid
      ? (isCaught ? COLORS.invalid : COLORS.missed)
      : COLORS.valid;

    // Lateral velocity for bezier-like curves
    const lateral = (Math.random() - 0.5) * 60;

    this.particles.push({
      x, y,
      vx: edge === 1 ? -lateral : edge === 3 ? lateral : lateral,
      vy: edge === 0 ? lateral : edge === 2 ? -lateral : lateral,
      color,
      alpha: 1,
      life: 1.5 + Math.random(),
      maxLife: 1.5 + Math.random(),
    });
  }
}
