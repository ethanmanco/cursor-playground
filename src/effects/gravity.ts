import type { Effect, Env } from '../engine/types';
import { hexToHue } from './lib/color';

type S = { color: string; pull: number; count: number };

interface Mote {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
}

// Your cursor is a tiny black hole. Motes fall in, swing around, and get
// swallowed. Hold the button down to push them away instead.
const motes: Mote[] = [];

function spawn(env: Env, m?: Mote): Mote {
  const edge = Math.floor(Math.random() * 4);
  const x = edge === 0 ? 0 : edge === 1 ? env.width : Math.random() * env.width;
  const y = edge === 2 ? 0 : edge === 3 ? env.height : Math.random() * env.height;
  const a = Math.random() * Math.PI * 2;
  const v = 20 + Math.random() * 60;
  const out = m ?? ({} as Mote);
  Object.assign(out, { x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
  return out;
}

export const gravity: Effect<S> = {
  id: 'gravity',
  name: 'Gravity well',
  blurb: 'Your cursor pulls in drifting motes. Hold down to push them away.',
  category: 'physics',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#b28cff' },
    { kind: 'range', key: 'pull', label: 'Pull', min: 1, max: 10, step: 1, default: 5 },
    { kind: 'range', key: 'count', label: 'Motes', min: 60, max: 400, step: 20, default: 180 },
  ],

  setup() {
    motes.length = 0;
  },

  update(dt, env, s) {
    // Grow or shrink the swarm through the shared budget.
    const want = Math.round(s.count);
    if (motes.length < want) {
      const n = env.budget.take(want - motes.length);
      for (let i = 0; i < n; i++) {
        const m = spawn(env);
        m.x = Math.random() * env.width;
        m.y = Math.random() * env.height;
        m.px = m.x;
        m.py = m.y;
        motes.push(m);
      }
    } else if (motes.length > want) {
      env.budget.give(motes.length - want);
      motes.length = want;
    }

    const p = env.pointer;
    const G = s.pull * 4e6 * (p.down ? -0.6 : 1);
    const drag = Math.pow(0.996, dt * 60);
    for (const m of motes) {
      m.px = m.x;
      m.py = m.y;
      if (p.inside) {
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2) || 1;
        if (d < 10 && !p.down) {
          spawn(env, m);
          continue;
        }
        const a = G / (d2 + 2500);
        m.vx += (dx / d) * a * dt;
        m.vy += (dy / d) * a * dt;
      }
      m.vx *= drag;
      m.vy *= drag;
      const speed = Math.hypot(m.vx, m.vy);
      if (speed > 900) {
        m.vx *= 900 / speed;
        m.vy *= 900 / speed;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < -60 || m.x > env.width + 60 || m.y < -60 || m.y > env.height + 60) spawn(env, m);
    }
  },

  draw(env, s) {
    const ctx = env.front;
    const hue = hexToHue(s.color);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const m of motes) {
      const fast = Math.min(1, Math.hypot(m.vx, m.vy) / 600);
      ctx.strokeStyle = `hsla(${hue + fast * 40},100%,${62 + fast * 23}%,${0.6 + fast * 0.4})`;
      // Round caps keep slow motes visible as glowing dots.
      ctx.lineWidth = 3 - fast;
      ctx.beginPath();
      ctx.moveTo(m.px - (m.x - m.px) * 3, m.py - (m.y - m.py) * 3);
      ctx.lineTo(m.x + 0.01, m.y);
      ctx.stroke();
    }
    const p = env.pointer;
    if (p.inside) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, `hsla(${hue},100%,70%,0.35)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 26, p.y - 26, 52, 52);
    }
  },

  teardown(env) {
    env.budget.give(motes.length);
    motes.length = 0;
  },
};
