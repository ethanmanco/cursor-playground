import type { Effect } from '../engine/types';
import { glowSprite } from './lib/color';

type S = { depth: number; drift: number; density: number };

interface Mote {
  x: number; // 0..1
  y: number; // 0..1
  layer: number; // 0 far, 1 middle, 2 near
  r: number;
  tint: number;
  twinkle: number;
}

const SPEED = [0.25, 0.55, 1];
const TINTS = ['#9ec5ff', '#b28cff', '#ff9fe3', '#ffe2a8'];
const motes: Mote[] = [];
const sprites: HTMLCanvasElement[] = [];
let built = -1;
let ox = 0;
let oy = 0;

function build(n: number) {
  motes.length = 0;
  let seed = 3;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < n; i++) {
    const roll = rand();
    const layer = roll < 0.55 ? 0 : roll < 0.88 ? 1 : 2;
    motes.push({
      x: rand(),
      y: rand(),
      layer,
      r: layer === 0 ? 0.6 + rand() * 0.7 : layer === 1 ? 1.2 + rand() * 1.2 : 6 + rand() * 10,
      tint: Math.floor(rand() * TINTS.length),
      twinkle: 1 + rand() * 3,
    });
  }
}

const wrap = (v: number, size: number, pad: number) => ((((v + pad) % (size + pad * 2)) + size + pad * 2) % (size + pad * 2)) - pad;

export const parallax: Effect<S> = {
  id: 'parallax',
  name: 'Parallax drift',
  blurb: 'Layers of space dust drift by and shift as you move.',
  category: 'background',
  layer: 'back',
  settings: [
    { kind: 'range', key: 'depth', label: 'Depth', min: 0, max: 10, step: 1, default: 6 },
    { kind: 'range', key: 'drift', label: 'Drift speed', min: 0, max: 10, step: 1, default: 3 },
    { kind: 'range', key: 'density', label: 'Density', min: 1, max: 10, step: 1, default: 6 },
  ],

  setup() {
    built = -1;
    if (!sprites.length) for (const t of TINTS) sprites.push(glowSprite(t, 64));
  },

  update(dt, env, s) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const n = Math.round(s.density * (coarse ? 16 : 32));
    if (n !== built) {
      build(n);
      built = n;
    }
    const p = env.pointer;
    // On a tilted phone the layers shift with the tilt instead.
    const tx = env.tilt.active ? env.tilt.x : (p.x / env.width) * 2 - 1;
    const ty = env.tilt.active ? env.tilt.y : (p.y / env.height) * 2 - 1;
    const ease = Math.min(1, dt * 3);
    ox += (tx - ox) * ease;
    oy += (ty - oy) * ease;
  },

  draw(env, s) {
    const ctx = env.back;
    const { width: W, height: H, time } = env;
    const shift = s.depth * 14;
    for (const m of motes) {
      const k = SPEED[m.layer];
      const x = wrap(m.x * W + time * s.drift * 8 * k - ox * shift * k, W, 40);
      const y = wrap(m.y * H + time * s.drift * 2 * k - oy * shift * k, H, 40);
      if (m.layer === 2) {
        ctx.globalAlpha = 0.35;
        const r = m.r * 2;
        ctx.drawImage(sprites[m.tint], x - r, y - r, r * 2, r * 2);
      } else {
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(time * m.twinkle + m.x * 40);
        ctx.fillStyle = TINTS[m.tint];
        ctx.beginPath();
        ctx.arc(x, y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  teardown() {
    motes.length = 0;
    built = -1;
  },
};
