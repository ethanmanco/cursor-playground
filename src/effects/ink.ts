import type { Effect } from '../engine/types';
import { rgba } from './lib/color';

type S = { color: string; width: number; fade: number };

interface Dot {
  x: number;
  y: number;
  w: number;
  t: number;
  stroke: number;
}

// Points are smoothed into curves. Fast moves make thin lines, slow moves
// make thick ones, like a brush pen.
const dots: Dot[] = [];
let stroke = 0;
let wasInside = false;
let w = 0;

const cap = () => (matchMedia('(pointer: coarse)').matches ? 600 : 1500);

export const ink: Effect<S> = {
  id: 'ink',
  name: 'Fading ink',
  blurb: 'A brush-pen line that thins when you move fast, then fades.',
  category: 'drawing',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Ink color', default: '#b28cff' },
    { kind: 'range', key: 'width', label: 'Brush size', min: 2, max: 30, step: 1, default: 10 },
    { kind: 'range', key: 'fade', label: 'Fade time', min: 1, max: 10, step: 1, default: 3, unit: 's' },
  ],

  setup() {
    dots.length = 0;
  },

  update(dt, env, s) {
    const p = env.pointer;
    if (p.inside && !wasInside) stroke++;
    wasInside = p.inside;
    const dist = Math.hypot(p.x - p.px, p.y - p.py);
    if (p.inside && dist > 0.5) {
      const speed = dist / Math.max(dt, 0.001);
      const target = s.width * Math.min(1.3, Math.max(0.25, 1.3 - speed / 1400));
      w += (target - w) * 0.35;
      dots.push({ x: p.x, y: p.y, w, t: env.time, stroke });
    }
    let drop = 0;
    while (drop < dots.length && env.time - dots[drop].t > s.fade) drop++;
    drop = Math.max(drop, dots.length - cap());
    if (drop > 0) dots.splice(0, drop);
  },

  draw(env, s) {
    const ctx = env.front;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      // Pass 0 is a soft wide bleed, pass 1 is the crisp core.
      const spread = pass === 0 ? 2.4 : 1;
      const strength = pass === 0 ? 0.14 : 0.95;
      for (let i = 1; i < dots.length - 1; i++) {
        const a = dots[i - 1];
        const b = dots[i];
        const c = dots[i + 1];
        if (a.stroke !== b.stroke || b.stroke !== c.stroke) continue;
        const age = 1 - (env.time - b.t) / s.fade;
        if (age <= 0) continue;
        ctx.strokeStyle = rgba(s.color, strength * age);
        ctx.lineWidth = b.w * spread * (0.4 + 0.6 * age);
        ctx.beginPath();
        ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
        ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
        ctx.stroke();
      }
    }
  },

  teardown() {
    dots.length = 0;
  },
};
