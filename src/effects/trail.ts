import type { Effect } from '../engine/types';
import { glowSprite } from './lib/color';

type S = { color: string; size: number; amount: number };

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
}

const sparks: Spark[] = [];
let sprite: HTMLCanvasElement | null = null;
let spriteColor = '';
let carry = 0;

export const trail: Effect<S> = {
  id: 'trail',
  name: 'Particle trail',
  blurb: 'Glowing sparks spill out behind your cursor.',
  category: 'followers',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#6ee7ff' },
    { kind: 'range', key: 'size', label: 'Size', min: 4, max: 40, step: 1, default: 14 },
    { kind: 'range', key: 'amount', label: 'Amount', min: 1, max: 10, step: 1, default: 5 },
  ],

  setup() {
    carry = 0;
  },

  update(dt, env, s) {
    const p = env.pointer;
    if (p.inside) {
      const dist = Math.hypot(p.x - p.px, p.y - p.py);
      // More sparks the faster you move, plus a gentle shimmer when still.
      carry += dist * s.amount * 0.06 + s.amount * 3 * dt;
      const n = env.budget.take(carry);
      carry -= Math.floor(carry);
      for (let i = 0; i < n; i++) {
        const t = Math.random();
        const a = Math.random() * Math.PI * 2;
        const speed = 10 + Math.random() * 40;
        const max = 0.5 + Math.random() * 0.7;
        sparks.push({
          x: p.px + (p.x - p.px) * t,
          y: p.py + (p.y - p.py) * t,
          vx: Math.cos(a) * speed + p.vx * 0.08,
          vy: Math.sin(a) * speed + p.vy * 0.08,
          life: max,
          max,
          r: s.size * (0.5 + Math.random() * 0.7),
        });
      }
    } else {
      carry = 0;
    }

    const drag = Math.pow(0.9, dt * 60);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const k = sparks[i];
      k.life -= dt;
      if (k.life <= 0) {
        sparks[i] = sparks[sparks.length - 1];
        sparks.pop();
        env.budget.give(1);
        continue;
      }
      k.vx *= drag;
      k.vy = k.vy * drag - 12 * dt; // a slight upward float
      k.x += k.vx * dt;
      k.y += k.vy * dt;
    }
  },

  draw(env, s) {
    if (!sprite || spriteColor !== s.color) {
      sprite = glowSprite(s.color);
      spriteColor = s.color;
    }
    const ctx = env.front;
    ctx.globalCompositeOperation = 'lighter';
    for (const k of sparks) {
      const t = k.life / k.max;
      const r = k.r * (0.3 + 0.7 * t);
      ctx.globalAlpha = t;
      ctx.drawImage(sprite, k.x - r, k.y - r, r * 2, r * 2);
    }
  },

  teardown(env) {
    env.budget.give(sparks.length);
    sparks.length = 0;
  },
};
