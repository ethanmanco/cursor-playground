import type { Effect, Env } from '../engine/types';
import { rgba } from './lib/color';

type S = { color: string; count: number; size: number };

interface Eye {
  x: number;
  y: number;
  r: number;
  lx: number;
  ly: number;
  /** Seconds until the next blink. */
  next: number;
  /** Seconds left in the current blink, 0 when open. */
  blink: number;
}

const BLINK = 0.22;
const eyes: Eye[] = [];
let builtFor = '';

function build(env: Env, s: S) {
  eyes.length = 0;
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const want = Math.round(s.count);
  for (let tries = 0; eyes.length < want && tries < want * 60; tries++) {
    const r = s.size * (0.7 + rand() * 0.6);
    const x = r + 10 + rand() * (env.width - 2 * r - 20);
    const y = r + 10 + rand() * (env.height - 2 * r - 20);
    if (eyes.some((e) => Math.hypot(e.x - x, e.y - y) < e.r + r + 16)) continue;
    eyes.push({ x, y, r, lx: 0, ly: 0, next: 1 + rand() * 5, blink: 0 });
  }
}

export const watchingEyes: Effect<S> = {
  id: 'eyes',
  name: 'Watching eyes',
  blurb: 'Eyes around the screen follow you, and sometimes blink.',
  category: 'followers',
  layer: 'back',
  settings: [
    { kind: 'color', key: 'color', label: 'Iris color', default: '#7c9bff' },
    { kind: 'range', key: 'count', label: 'How many', min: 3, max: 16, step: 1, default: 8 },
    { kind: 'range', key: 'size', label: 'Size', min: 20, max: 80, step: 2, default: 40 },
  ],

  setup() {
    builtFor = '';
  },

  update(dt, env, s) {
    const key = `${s.count}|${s.size}|${env.width}|${env.height}`;
    if (key !== builtFor) {
      build(env, s);
      builtFor = key;
    }
    const p = env.pointer;
    const ease = Math.min(1, dt * 12);
    for (const e of eyes) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / (e.r * 6)) * e.r * 0.42;
      e.lx += ((dx / d) * reach - e.lx) * ease;
      e.ly += ((dy / d) * reach - e.ly) * ease;
      if (e.blink > 0) {
        e.blink = Math.max(0, e.blink - dt);
      } else if ((e.next -= dt) <= 0) {
        e.blink = BLINK;
        e.next = 2 + Math.random() * 6;
      }
    }
  },

  draw(env, s) {
    const ctx = env.back;
    for (const e of eyes) {
      const { x, y, r } = e;
      // Soft halo so the eyes read against dark space.
      const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 1.6);
      halo.addColorStop(0, rgba(s.color, 0.25));
      halo.addColorStop(1, rgba(s.color, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      const white = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      white.addColorStop(0, '#ffffff');
      white.addColorStop(1, '#c4c8ea');
      ctx.fillStyle = white;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);

      const ix = x + e.lx;
      const iy = y + e.ly;
      const ir = r * 0.5;
      const iris = ctx.createRadialGradient(ix, iy, ir * 0.2, ix, iy, ir);
      iris.addColorStop(0, rgba(s.color, 0.6));
      iris.addColorStop(1, s.color);
      ctx.fillStyle = iris;
      ctx.beginPath();
      ctx.arc(ix, iy, ir, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#05060f';
      ctx.beginPath();
      ctx.arc(ix, iy, ir * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(ix - ir * 0.3, iy - ir * 0.35, ir * 0.18, 0, Math.PI * 2);
      ctx.fill();

      if (e.blink > 0) {
        const c = Math.sin((1 - e.blink / BLINK) * Math.PI); // 0 to 1 and back
        ctx.fillStyle = '#1b1636';
        ctx.fillRect(x - r, y - r, r * 2, r * c);
        ctx.fillRect(x - r, y + r - r * c, r * 2, r * c);
      }
      ctx.restore();

      ctx.strokeStyle = rgba(s.color, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  resize() {
    builtFor = '';
  },

  teardown() {
    eyes.length = 0;
    builtFor = '';
  },
};
