import type { Effect } from '../engine/types';
import { arrowPath } from './lib/arrow';
import { hexToHue } from './lib/color';

type S = { color: string; count: number; spacing: number };

// Cursor conga: a line of little cursors follows exactly in your footsteps,
// each one waddling a bit as it goes. Stop, and they bunch up behind you.

const path: { x: number; y: number }[] = [];

/** The point `dist` pixels back along the recorded path. */
function along(dist: number): { x: number; y: number } | null {
  let left = dist;
  for (let i = path.length - 1; i > 0; i--) {
    const a = path[i];
    const b = path[i - 1];
    const seg = Math.hypot(a.x - b.x, a.y - b.y);
    if (seg >= left) {
      const k = left / (seg || 1);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    left -= seg;
  }
  return path[0] ?? null;
}

export const conga: Effect<S> = {
  id: 'conga',
  name: 'Cursor conga',
  blurb: 'A line of little cursors follows in your footsteps.',
  category: 'followers',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#ffd166' },
    { kind: 'range', key: 'count', label: 'Dancers', min: 3, max: 20, step: 1, default: 8 },
    { kind: 'range', key: 'spacing', label: 'Spacing', min: 12, max: 44, step: 2, default: 24 },
  ],

  setup() {
    path.length = 0;
  },

  update(_dt, env, s) {
    const p = env.pointer;
    if (!p.inside) return;
    const last = path[path.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 2) path.push({ x: p.x, y: p.y });
    // Keep only as much path as the line needs.
    let total = 0;
    for (let i = path.length - 1; i > 0; i--) {
      total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      if (total > (s.count + 2) * s.spacing) {
        path.splice(0, i - 1);
        break;
      }
    }
  },

  draw(env, s) {
    if (!env.pointer.inside || path.length < 2) return;
    const ctx = env.front;
    const hue = hexToHue(s.color);
    const n = Math.round(s.count);
    // Draw from the back of the line forward, so the first dancer is on top.
    for (let i = n; i >= 1; i--) {
      const at = along(i * s.spacing);
      if (!at) continue;
      const bob = Math.sin(env.time * 9 - i * 0.8) * 2;
      const size = 18 - (i / n) * 6;
      ctx.fillStyle = `hsl(${hue + i * (220 / n)},95%,66%)`;
      ctx.strokeStyle = 'rgba(5,6,15,0.7)';
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      arrowPath(ctx, at.x, at.y + bob, size);
      ctx.fill();
      ctx.stroke();
    }
  },

  teardown() {
    path.length = 0;
  },
};
