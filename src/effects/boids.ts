import type { Effect, Env } from '../engine/types';
import { hexToHue } from './lib/color';

type S = { color: string; count: number; speed: number };

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  shade: number;
}

// Classic flocking: each boid keeps some space, matches its neighbors'
// heading, and drifts toward the group. They also chase your cursor, and
// scatter when you press.
const flock: Boid[] = [];

function spawn(env: Env): Boid {
  const a = Math.random() * Math.PI * 2;
  return {
    x: Math.random() * env.width,
    y: Math.random() * env.height,
    vx: Math.cos(a) * 80,
    vy: Math.sin(a) * 80,
    shade: Math.random() * 30 - 15,
  };
}

export const boids: Effect<S> = {
  id: 'boids',
  name: 'Boids flock',
  blurb: 'A flock of tiny ships follows you. Press to scatter them.',
  category: 'followers',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#6ee7ff' },
    { kind: 'range', key: 'count', label: 'Flock size', min: 10, max: 120, step: 5, default: 50 },
    { kind: 'range', key: 'speed', label: 'Speed', min: 1, max: 10, step: 1, default: 5 },
  ],

  setup() {
    flock.length = 0;
  },

  update(dt, env, s) {
    const want = Math.round(s.count * (matchMedia('(pointer: coarse)').matches ? 0.6 : 1));
    while (flock.length < want) flock.push(spawn(env));
    flock.length = want;

    const max = 60 + s.speed * 30;
    const p = env.pointer;
    for (const b of flock) {
      let sx = 0, sy = 0; // separation
      let ax = 0, ay = 0; // alignment
      let cx = 0, cy = 0; // cohesion
      let n = 0;
      for (const o of flock) {
        if (o === b) continue;
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 3600) continue;
        n++;
        ax += o.vx;
        ay += o.vy;
        cx += dx;
        cy += dy;
        if (d2 < 400) {
          sx -= dx / (d2 + 1) * 400;
          sy -= dy / (d2 + 1) * 400;
        }
      }
      let fx = sx * 6;
      let fy = sy * 6;
      if (n) {
        fx += (ax / n - b.vx) * 1.2 + (cx / n) * 0.8;
        fy += (ay / n - b.vy) * 1.2 + (cy / n) * 0.8;
      }
      if (p.inside) {
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = p.down ? -900 : 160;
        fx += (dx / d) * k;
        fy += (dy / d) * k;
      }
      b.vx += fx * dt;
      b.vy += fy * dt;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const clamped = Math.min(max * (p.down ? 2 : 1), Math.max(max * 0.4, sp));
      b.vx = (b.vx / sp) * clamped;
      b.vy = (b.vy / sp) * clamped;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // Wrap around the screen edges.
      if (b.x < -10) b.x += env.width + 20;
      else if (b.x > env.width + 10) b.x -= env.width + 20;
      if (b.y < -10) b.y += env.height + 20;
      else if (b.y > env.height + 10) b.y -= env.height + 20;
    }
  },

  draw(env, s) {
    const ctx = env.front;
    const hue = hexToHue(s.color);
    for (const b of flock) {
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const fx = b.vx / sp;
      const fy = b.vy / sp;
      ctx.fillStyle = `hsl(${hue + b.shade},95%,66%)`;
      ctx.beginPath();
      ctx.moveTo(b.x + fx * 9, b.y + fy * 9);
      ctx.lineTo(b.x - fx * 6 - fy * 5, b.y - fy * 6 + fx * 5);
      ctx.lineTo(b.x - fx * 3, b.y - fy * 3);
      ctx.lineTo(b.x - fx * 6 + fy * 5, b.y - fy * 6 - fx * 5);
      ctx.closePath();
      ctx.fill();
    }
  },

  teardown() {
    flock.length = 0;
  },
};
