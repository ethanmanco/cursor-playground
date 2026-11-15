import type { Effect } from '../engine/types';
import { arrowPath } from './lib/arrow';

type S = { spread: number; size: number; trail: number };

// Chromatic cursor: red, green, and blue copies of your cursor, each on a
// slightly different spring. Standing still they line up into white; move and
// they split into rainbow fringes, like an old 3D picture or a glitchy screen.

interface Copy {
  color: string;
  stiffness: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
}

const copies: Copy[] = [
  { color: 'rgb(255,60,90)', stiffness: 1, x: 0, y: 0, vx: 0, vy: 0, trail: [] },
  { color: 'rgb(60,255,140)', stiffness: 0.62, x: 0, y: 0, vx: 0, vy: 0, trail: [] },
  { color: 'rgb(70,120,255)', stiffness: 0.38, x: 0, y: 0, vx: 0, vy: 0, trail: [] },
];

export const chroma: Effect<S> = {
  id: 'chroma',
  name: 'Chromatic cursor',
  blurb: 'Red, green, and blue copies of your cursor split apart as you move.',
  category: 'trippy',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'spread', label: 'Split', min: 1, max: 10, step: 1, default: 5 },
    { kind: 'range', key: 'size', label: 'Size', min: 14, max: 40, step: 2, default: 22 },
    { kind: 'range', key: 'trail', label: 'Trail', min: 0, max: 10, step: 1, default: 4 },
  ],

  setup(env) {
    for (const c of copies) {
      c.x = env.pointer.x;
      c.y = env.pointer.y;
      c.vx = c.vy = 0;
      c.trail = [];
    }
  },

  update(dt, env, s) {
    const p = env.pointer;
    // Higher split means looser springs, so the colors drift further apart.
    const base = 520 / (0.6 + s.spread * 0.35);
    for (const c of copies) {
      const k = base * c.stiffness;
      const damping = 2 * Math.sqrt(k) * 0.75;
      c.vx += ((p.x - c.x) * k - c.vx * damping) * dt;
      c.vy += ((p.y - c.y) * k - c.vy * damping) * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.trail.unshift({ x: c.x, y: c.y });
      const keep = Math.round(s.trail * 3);
      if (c.trail.length > keep) c.trail.length = keep;
    }
  },

  draw(env, s) {
    if (!env.pointer.inside) return;
    const ctx = env.front;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const c of copies) {
      if (c.trail.length > 1) {
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 2;
        for (let i = c.trail.length - 1; i > 0; i--) {
          ctx.globalAlpha = (1 - i / c.trail.length) * 0.5;
          ctx.beginPath();
          ctx.moveTo(c.trail[i].x, c.trail[i].y);
          ctx.lineTo(c.trail[i - 1].x, c.trail[i - 1].y);
          ctx.stroke();
        }
      }
      // Additive red + green + blue makes white where the copies overlap.
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = c.color;
      arrowPath(ctx, c.x, c.y, s.size);
      ctx.fill();
    }
  },

  teardown() {
    for (const c of copies) c.trail = [];
  },
};
