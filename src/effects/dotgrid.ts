import type { Effect, Env } from '../engine/types';
import { blastAt } from '../engine/blasts';
import { rgba } from './lib/color';

type S = { color: string; spacing: number; radius: number };

// Every dot sits on a spring. The cursor pushes dots away, and clicks send
// out a ring that shoves them as it passes.
let restX = new Float32Array(0);
let restY = new Float32Array(0);
let offX = new Float32Array(0);
let offY = new Float32Array(0);
let velX = new Float32Array(0);
let velY = new Float32Array(0);
let builtFor = '';
const rings: { x: number; y: number; t: number }[] = [];

const RING_SPEED = 520;
const RING_LIFE = 1.4;

function build(env: Env, spacing: number) {
  const cols = Math.ceil(env.width / spacing) + 1;
  const rows = Math.ceil(env.height / spacing) + 1;
  const n = cols * rows;
  restX = new Float32Array(n);
  restY = new Float32Array(n);
  offX = new Float32Array(n);
  offY = new Float32Array(n);
  velX = new Float32Array(n);
  velY = new Float32Array(n);
  const x0 = (env.width - (cols - 1) * spacing) / 2;
  const y0 = (env.height - (rows - 1) * spacing) / 2;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++, i++) {
      restX[i] = x0 + c * spacing;
      restY[i] = y0 + r * spacing;
    }
  }
}

export const dotGrid: Effect<S> = {
  id: 'dotgrid',
  name: 'Ripple grid',
  blurb: 'A field of dots that bends away from you. Click to send a ripple.',
  category: 'background',
  layer: 'back',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#7c9bff' },
    { kind: 'range', key: 'spacing', label: 'Spacing', min: 16, max: 48, step: 2, default: 28 },
    { kind: 'range', key: 'radius', label: 'Reach', min: 40, max: 260, step: 10, default: 130 },
  ],

  setup() {
    builtFor = '';
    rings.length = 0;
  },

  onPointerDown(env) {
    rings.push({ x: env.pointer.x, y: env.pointer.y, t: env.time });
    if (rings.length > 6) rings.shift();
  },

  update(dt, env, s) {
    // Phones get a looser grid so there are fewer dots to move.
    const spacing = Math.max(s.spacing, matchMedia('(pointer: coarse)').matches ? 30 : 0);
    const key = `${spacing}|${env.width}|${env.height}`;
    if (key !== builtFor) {
      build(env, spacing);
      builtFor = key;
    }
    while (rings.length && (env.time - rings[0].t) > RING_LIFE) rings.shift();

    const p = env.pointer;
    const R = s.radius;
    const R2 = R * R;
    const n = restX.length;
    for (let i = 0; i < n; i++) {
      const x = restX[i] + offX[i];
      const y = restY[i] + offY[i];
      let fx = -offX[i] * 70 - velX[i] * 9;
      let fy = -offY[i] * 70 - velY[i] * 9;
      if (p.inside) {
        const dx = x - p.x;
        const dy = y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (1 - d / R) ** 2 * 2600;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      for (const ring of rings) {
        const age = env.time - ring.t;
        const front = age * RING_SPEED;
        const dx = x - ring.x;
        const dy = y - ring.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const gap = Math.abs(d - front);
        if (gap < 34) {
          const f = (1 - gap / 34) * 5200 * (1 - age / RING_LIFE);
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      if (env.blasts.length) {
        const hit = blastAt(env.blasts, x, y);
        fx += hit.fx * 0.6;
        fy += hit.fy * 0.6;
      }
      velX[i] += fx * dt;
      velY[i] += fy * dt;
      offX[i] += velX[i] * dt;
      offY[i] += velY[i] * dt;
    }
  },

  draw(env, s) {
    const ctx = env.back;
    const n = restX.length;
    // Resting dots in one pass, lit-up dots on top.
    ctx.fillStyle = rgba(s.color, 0.28);
    const lit: number[] = [];
    for (let i = 0; i < n; i++) {
      const moved = Math.abs(offX[i]) + Math.abs(offY[i]);
      if (moved > 0.6) lit.push(i);
      else ctx.fillRect(restX[i] + offX[i] - 1, restY[i] + offY[i] - 1, 2, 2);
    }
    for (const i of lit) {
      const g = Math.min(1, (Math.abs(offX[i]) + Math.abs(offY[i])) / 18);
      ctx.fillStyle = rgba(s.color, 0.35 + g * 0.65);
      ctx.beginPath();
      ctx.arc(restX[i] + offX[i], restY[i] + offY[i], 1.2 + g * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  resize() {
    builtFor = '';
  },

  teardown() {
    restX = restY = offX = offY = velX = velY = new Float32Array(0);
    builtFor = '';
    rings.length = 0;
  },
};
