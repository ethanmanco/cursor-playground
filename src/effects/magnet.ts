import type { Effect } from '../engine/types';
import { rgba } from './lib/color';

type S = { color: string; spacing: number; strength: number };

// Iron filings around a magnet. Your cursor is the magnet's north pole and
// its south pole trails behind you, so the filings line up along curving
// field lines and swing smoothly as you move.

let angles = new Float32Array(0);
let bright = new Float32Array(0);
let step = 24;
let cols = 0;
let rows = 0;
let builtFor = '';
let nx = 0;
let ny = 0;
let dirX = 1;
let dirY = 0;
let near = 0;

const LEVELS = 6;

export const magnet: Effect<S> = {
  id: 'magnet',
  name: 'Magnetic field',
  blurb: 'Iron filings line up along the field of a magnet you carry.',
  category: 'physics',
  layer: 'back',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#9ec5ff' },
    { kind: 'range', key: 'spacing', label: 'Spacing', min: 16, max: 40, step: 2, default: 24 },
    { kind: 'range', key: 'strength', label: 'Glow', min: 1, max: 10, step: 1, default: 6 },
  ],

  setup(env) {
    builtFor = '';
    nx = env.pointer.x;
    ny = env.pointer.y;
  },

  update(dt, env, s) {
    const spacing = Math.max(s.spacing, matchMedia('(pointer: coarse)').matches ? 28 : 0);
    const key = `${spacing}|${env.width}|${env.height}`;
    step = spacing;
    if (key !== builtFor) {
      cols = Math.ceil(env.width / spacing) + 1;
      rows = Math.ceil(env.height / spacing) + 1;
      angles = new Float32Array(cols * rows);
      bright = new Float32Array(cols * rows);
      builtFor = key;
    }

    const p = env.pointer;
    const ease = Math.min(1, dt * 10);
    nx += (p.x - nx) * ease;
    ny += (p.y - ny) * ease;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 30) {
      // The magnet points the way you move.
      const k = Math.min(1, dt * 4);
      dirX += (p.vx / speed - dirX) * k;
      dirY += (p.vy / speed - dirY) * k;
      const l = Math.hypot(dirX, dirY) || 1;
      dirX /= l;
      dirY /= l;
    }
    near += ((p.inside ? 1 : 0.45) - near) * Math.min(1, dt * 2);
    const sx = nx - dirX * 130;
    const sy = ny - dirY * 130;

    const turn = Math.min(1, dt * 9);
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++, i++) {
        const x = c * spacing;
        const y = r * spacing;
        const ax = x - nx;
        const ay = y - ny;
        const bx = x - sx;
        const by = y - sy;
        const da = Math.pow(ax * ax + ay * ay + 100, 1.5);
        const db = Math.pow(bx * bx + by * by + 100, 1.5);
        const fx = ax / da - bx / db;
        const fy = ay / da - by / db;
        const target = Math.atan2(fy, fx);
        // Filings have no head or tail, so turn the short way (mod 180 deg).
        let diff = target - angles[i];
        diff = Math.atan2(Math.sin(2 * diff), Math.cos(2 * diff)) / 2;
        angles[i] += diff * turn;
        const mag = Math.log10(Math.hypot(fx, fy) + 1e-12);
        bright[i] = Math.min(1, Math.max(0.06, (mag + 5.6) / 2.4)) * near;
      }
    }
  },

  draw(env, s) {
    const ctx = env.back;
    const len = step * 0.32;
    const glow = 0.4 + s.strength * 0.06;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.6;
    // Group filings into a few brightness levels so each level is one stroke.
    for (let level = 0; level < LEVELS; level++) {
      const lo = level / LEVELS;
      const hi = (level + 1) / LEVELS;
      ctx.beginPath();
      let any = false;
      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++, i++) {
          const b = bright[i];
          if (b < lo || b >= hi) continue;
          const x = c * step;
          const y = r * step;
          const L = len * (0.6 + 0.6 * b);
          const dx = Math.cos(angles[i]) * L;
          const dy = Math.sin(angles[i]) * L;
          ctx.moveTo(x - dx, y - dy);
          ctx.lineTo(x + dx, y + dy);
          any = true;
        }
      }
      if (!any) continue;
      ctx.strokeStyle = rgba(s.color, Math.min(1, (0.12 + hi * 0.88) * glow));
      ctx.stroke();
    }
  },

  resize() {
    builtFor = '';
  },

  teardown() {
    builtFor = '';
  },
};
