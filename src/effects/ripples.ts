import type { Effect } from '../engine/types';
import { rgba } from './lib/color';

type S = { color: string; size: number; drops: number };

// Pond ripples: moving the cursor drops small, quiet ripples behind it, like
// trailing a finger across still water. Clicking drops a bigger one. Each
// ripple is a few thin rings that spread out and fade.

interface Ripple {
  x: number;
  y: number;
  age: number;
  life: number;
  size: number;
}

const ripples: Ripple[] = [];
let travel = 0;

export const pondRipples: Effect<S> = {
  id: 'ripples',
  name: 'Pond ripples',
  blurb: 'Quiet ripples spread out behind your cursor, like a finger in water.',
  category: 'followers',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#9ec5ff' },
    { kind: 'range', key: 'size', label: 'Ripple size', min: 40, max: 200, step: 10, default: 110 },
    { kind: 'range', key: 'drops', label: 'How often', min: 1, max: 10, step: 1, default: 5 },
  ],

  setup() {
    ripples.length = 0;
    travel = 0;
  },

  onPointerDown(env, s) {
    ripples.push({ x: env.pointer.x, y: env.pointer.y, age: 0, life: 2.4, size: s.size * 1.6 });
  },

  update(dt, env, s) {
    const p = env.pointer;
    if (p.inside) {
      travel += Math.hypot(p.x - p.px, p.y - p.py);
      const gap = 150 - s.drops * 12;
      if (travel > gap) {
        travel = 0;
        ripples.push({ x: p.x, y: p.y, age: 0, life: 1.8, size: s.size });
      }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.age += dt;
      if (r.age > r.life) ripples.splice(i, 1);
      else if (r.size > s.size) {
        // Big (clicked) ripples gently nudge other effects as they pass.
        const k = r.age / r.life;
        env.blast({ x: r.x, y: r.y, radius: r.size * (1 - Math.pow(1 - k, 2)), strength: 500 * (1 - k), kind: 'push', ring: true });
      }
    }
    if (ripples.length > 40) ripples.splice(0, ripples.length - 40);
  },

  draw(env, s) {
    const ctx = env.front;
    ctx.lineWidth = 1.2;
    for (const r of ripples) {
      const k = r.age / r.life;
      for (let ring = 0; ring < 3; ring++) {
        // Rings start one after another and slow as they spread.
        const rk = Math.max(0, k - ring * 0.12);
        if (rk <= 0) continue;
        const radius = r.size * (1 - Math.pow(1 - rk, 2));
        ctx.strokeStyle = rgba(s.color, (1 - rk) * (0.5 - ring * 0.12));
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, radius, radius * 0.92, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  },

  teardown() {
    ripples.length = 0;
  },
};
