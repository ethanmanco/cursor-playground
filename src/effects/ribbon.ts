import type { Effect } from '../engine/types';
import { hexToHue } from './lib/color';

type S = { color: string; length: number; width: number };

// A follow-the-leader chain: each bead stays a fixed gap behind the one in front.
const beads: { x: number; y: number }[] = [];

export const ribbon: Effect<S> = {
  id: 'ribbon',
  name: 'Ribbon snake',
  blurb: 'A wiggly space snake slithers after your cursor.',
  category: 'followers',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#8affc1' },
    { kind: 'range', key: 'length', label: 'Length', min: 10, max: 60, step: 1, default: 32 },
    { kind: 'range', key: 'width', label: 'Thickness', min: 4, max: 30, step: 1, default: 14 },
  ],

  setup(env) {
    beads.length = 0;
    beads.push({ x: env.pointer.x, y: env.pointer.y });
  },

  update(dt, env, s) {
    const n = Math.round(s.length);
    while (beads.length < n) beads.push({ ...beads[beads.length - 1] });
    beads.length = n;
    const head = beads[0];
    const ease = Math.min(1, dt * 9);
    head.x += (env.pointer.x - head.x) * ease;
    head.y += (env.pointer.y - head.y) * ease;
    const gap = Math.max(2, s.width * 0.3);
    for (let i = 1; i < n; i++) {
      const a = beads[i - 1];
      const b = beads[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > gap) {
        b.x = a.x + (dx / d) * gap;
        b.y = a.y + (dy / d) * gap;
      }
    }
  },

  draw(env, s) {
    const ctx = env.front;
    const n = beads.length;
    const base = hexToHue(s.color);
    const t = env.time;
    // Tail first so the head is drawn on top.
    for (let i = n - 1; i >= 0; i--) {
      const b = beads[i];
      const prev = beads[Math.max(0, i - 1)];
      const next = beads[Math.min(n - 1, i + 1)];
      let nx = -(prev.y - next.y);
      let ny = prev.x - next.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      const k = i / n;
      const wiggle = Math.sin(t * 7 - i * 0.45) * s.width * 0.35 * k;
      const r = (s.width / 2) * (1 - k * 0.55);
      ctx.fillStyle = `hsl(${base + i * 1.5},90%,${64 - k * 14}%)`;
      ctx.beginPath();
      ctx.arc(b.x + nx * wiggle, b.y + ny * wiggle, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (n > 1) {
      const h = beads[0];
      const dx = h.x - beads[1].x;
      const dy = h.y - beads[1].y;
      const d = Math.hypot(dx, dy) || 1;
      const fx = dx / d;
      const fy = dy / d;
      const r = s.width / 2;
      for (const side of [-1, 1]) {
        const ex = h.x + fx * r * 0.3 - fy * side * r * 0.45;
        const ey = h.y + fy * r * 0.3 + fx * side * r * 0.45;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, ey, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#05060f';
        ctx.beginPath();
        ctx.arc(ex + fx * r * 0.1, ey + fy * r * 0.1, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  teardown() {
    beads.length = 0;
  },
};
