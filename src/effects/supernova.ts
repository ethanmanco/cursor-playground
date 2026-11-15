import type { Effect } from '../engine/types';
import { glowSprite } from './lib/color';

// Supernova: a one-off moment, started by a double-click or double-tap.
// Everything is pulled toward one point while a hot core spins up, there is
// a short hush, then it bursts outward and shoves every other effect away.
// It is not in the effects list; the page switches it on when triggered,
// and it switches itself off when done.

const COLLAPSE = 1.2;
const HUSH = 0.18;
const BLAST = 1.6;
const END = COLLAPSE + HUSH + BLAST + 0.6;

interface Spark {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

let t = 0;
let cx = 0;
let cy = 0;
let boomed = false;
const sparks: Spark[] = [];
let core: HTMLCanvasElement | null = null;

/** Where the next supernova happens. Call before switching it on. */
export function aimSupernova(x: number, y: number): void {
  cx = x;
  cy = y;
}

export const supernova: Effect<Record<string, never>> = {
  id: 'supernova',
  name: 'Supernova',
  blurb: 'Double-click or double-tap anywhere.',
  category: 'click',
  layer: 'front',
  snippet: false,
  settings: [],

  setup(env) {
    t = 0;
    boomed = false;
    core ??= glowSprite('#bfe3ff', 128);
    env.cue('collapse', cx);
  },

  update(dt, env) {
    t += dt;
    const big = Math.hypot(env.width, env.height);
    if (t < COLLAPSE) {
      // Gravity builds up as the star collapses.
      const k = t / COLLAPSE;
      env.blast({ x: cx, y: cy, radius: big, strength: 600 + 5200 * k * k, kind: 'pull' });
    } else if (t > COLLAPSE + HUSH) {
      if (!boomed) {
        boomed = true;
        env.cue('boom', cx);
        const n = env.budget.take(220);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = 250 + Math.random() * 900;
          sparks.push({ x: cx, y: cy, px: cx, py: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8 + Math.random() * 1.2, hue: 190 + Math.random() * 150 });
        }
      }
      const p = Math.min(1, (t - COLLAPSE - HUSH) / BLAST);
      if (p < 1) {
        env.blast({ x: cx, y: cy, radius: 80 + p * big, strength: 9000 * (1 - p), kind: 'push' });
        env.blast({ x: cx, y: cy, radius: 200 + p * big * 0.6, strength: 1 - p, kind: 'light' });
      }
    }
    const drag = Math.pow(0.97, dt * 60);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        sparks[i] = sparks[sparks.length - 1];
        sparks.pop();
        env.budget.give(1);
        continue;
      }
      s.px = s.x;
      s.py = s.y;
      s.vx *= drag;
      s.vy *= drag;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
  },

  draw(env) {
    const ctx = env.front;
    const big = Math.hypot(env.width, env.height);
    ctx.globalCompositeOperation = 'lighter';

    if (t < COLLAPSE + HUSH) {
      const k = Math.min(1, t / COLLAPSE);
      // A spinning ring of hot gas, tightening as it falls in.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (2 + k * 10));
      const ring = 140 * (1 - k) + 18;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `hsla(${200 + i * 50},100%,70%,${0.25 + k * 0.5})`;
        ctx.lineWidth = 2 + k * 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, ring + i * 6, (ring + i * 6) * 0.38, i * 0.7, 0, Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.restore();
      const r = 10 + k * 34;
      ctx.drawImage(core!, cx - r, cy - r, r * 2, r * 2);
    }

    if (t > COLLAPSE + HUSH) {
      const p = Math.min(1, (t - COLLAPSE - HUSH) / BLAST);
      // One soft local flash at the start (not a strobe).
      if (p < 0.35) {
        const f = 1 - p / 0.35;
        const r = 60 + p * 700;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,255,255,${0.6 * f})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      // Expanding shells.
      if (p < 1) {
        for (let i = 0; i < 3; i++) {
          const r = (p * big * 0.75) * (1 - i * 0.12);
          ctx.strokeStyle = `hsla(${190 + i * 60},100%,70%,${(1 - p) * 0.8})`;
          ctx.lineWidth = 2 + (1 - p) * 10;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
      for (const s of sparks) {
        ctx.strokeStyle = `hsla(${s.hue},100%,75%,${Math.min(1, s.life)})`;
        ctx.beginPath();
        ctx.moveTo(s.px - (s.x - s.px) * 2, s.py - (s.y - s.py) * 2);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
    }
  },

  finished() {
    return t > END && sparks.length === 0;
  },

  teardown(env) {
    env.budget.give(sparks.length);
    sparks.length = 0;
  },
};
