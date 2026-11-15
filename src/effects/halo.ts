import type { Effect } from '../engine/types';
import { rgba } from './lib/color';

type S = { color: string; size: number; breath: number };

// A soft halo of light that follows your cursor and slowly breathes in and
// out. Calm on its own, and a nice glow under other effects.

let x = 0;
let y = 0;
let shown = 0;

export const halo: Effect<S> = {
  id: 'halo',
  name: 'Soft halo',
  blurb: 'A gentle glow follows your cursor and slowly breathes.',
  category: 'cursor',
  layer: 'back',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#b9c8ff' },
    { kind: 'range', key: 'size', label: 'Size', min: 40, max: 220, step: 10, default: 110 },
    { kind: 'range', key: 'breath', label: 'Breathing', min: 0, max: 10, step: 1, default: 4 },
  ],

  setup(env) {
    x = env.pointer.x;
    y = env.pointer.y;
    shown = 0;
  },

  update(dt, env) {
    const p = env.pointer;
    const ease = Math.min(1, dt * 7);
    x += (p.x - x) * ease;
    y += (p.y - y) * ease;
    shown += ((p.inside ? 1 : 0) - shown) * Math.min(1, dt * 3);
  },

  draw(env, s) {
    if (shown < 0.01) return;
    const ctx = env.back;
    // About one slow breath every four seconds.
    const breath = Math.sin(env.time * 1.6) * (s.breath / 10);
    const r = s.size * (1 + breath * 0.12);
    const a = shown * (0.32 + breath * 0.06);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(s.color, a));
    g.addColorStop(0.35, rgba(s.color, a * 0.45));
    g.addColorStop(1, rgba(s.color, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    // A faint ring at the edge of the glow.
    ctx.strokeStyle = rgba(s.color, a * 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
  },

  teardown() {},
};
