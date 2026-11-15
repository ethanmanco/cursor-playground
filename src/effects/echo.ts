import type { Effect } from '../engine/types';

type S = { copies: number; delay: number; spin: number };

// Rainbow ghost cursors replay where your cursor was a moment ago, each one
// a little later than the last. Turn up Spin and they swirl around you.
const history: { x: number; y: number; t: number }[] = [];

function sample(at: number): { x: number; y: number } | null {
  // Newest is last. Walk back to the first sample at or before `at`.
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].t <= at) return history[i];
  }
  return history[0] ?? null;
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const k = size / 20;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 19 * k);
  ctx.lineTo(x + 5 * k, y + 14 * k);
  ctx.lineTo(x + 9 * k, y + 22 * k);
  ctx.lineTo(x + 12.5 * k, y + 20.5 * k);
  ctx.lineTo(x + 8.5 * k, y + 12.8 * k);
  ctx.lineTo(x + 15.5 * k, y + 12.8 * k);
  ctx.closePath();
}

export const echo: Effect<S> = {
  id: 'echo',
  name: 'Echo cursors',
  blurb: 'Rainbow ghost cursors replay your moves a beat behind.',
  category: 'trippy',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'copies', label: 'Ghosts', min: 3, max: 16, step: 1, default: 8 },
    { kind: 'range', key: 'delay', label: 'Delay', min: 1, max: 10, step: 1, default: 3 },
    { kind: 'range', key: 'spin', label: 'Spin', min: 0, max: 10, step: 1, default: 0 },
  ],

  setup() {
    history.length = 0;
  },

  update(_dt, env, s) {
    const p = env.pointer;
    if (p.inside) history.push({ x: p.x, y: p.y, t: env.time });
    const keep = s.copies * s.delay * 0.04 + 0.2;
    while (history.length > 2 && env.time - history[0].t > keep) history.shift();
  },

  draw(env, s) {
    const p = env.pointer;
    if (!p.inside || !history.length) return;
    const ctx = env.front;
    const n = Math.round(s.copies);
    const step = s.delay * 0.04;
    ctx.lineJoin = 'round';
    for (let i = n; i >= 1; i--) {
      const at = sample(env.time - i * step);
      if (!at) continue;
      let x = at.x;
      let y = at.y;
      if (s.spin > 0) {
        // Swing each ghost around the real cursor.
        const a = env.time * s.spin * 0.3 + (i / n) * Math.PI * 2;
        const r = i * 6;
        x += Math.cos(a) * r;
        y += Math.sin(a) * r;
      }
      const k = i / n;
      ctx.globalAlpha = 0.85 - k * 0.6;
      ctx.fillStyle = `hsl(${(env.time * 60 + i * (300 / n)) % 360},100%,62%)`;
      arrow(ctx, x, y, 22 - k * 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(5,6,15,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  },

  teardown() {
    history.length = 0;
  },
};
