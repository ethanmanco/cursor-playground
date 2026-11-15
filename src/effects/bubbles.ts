import type { Effect, Env } from '../engine/types';
import { blastAt } from '../engine/blasts';

type S = { size: number; amount: number; tint: number };

// Press and hold to blow soap bubbles. They float up and wobble, shimmer with
// rainbow film colors, and pop when your cursor touches them.

interface Bubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  wobble: number;
  film: number;
  age: number;
}

interface Pop {
  x: number;
  y: number;
  r: number;
  age: number;
}

const bubbles: Bubble[] = [];
const pops: Pop[] = [];
let carry = 0;

function blow(env: Env, s: S, n: number) {
  const got = env.budget.take(n);
  const p = env.pointer;
  for (let i = 0; i < got; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const v = 40 + Math.random() * 80;
    bubbles.push({
      x: p.x + (Math.random() - 0.5) * 10,
      y: p.y + (Math.random() - 0.5) * 10,
      vx: Math.cos(a) * v + p.vx * 0.15,
      vy: Math.sin(a) * v + p.vy * 0.15,
      r: s.size * (0.4 + Math.random() * 0.8),
      wobble: Math.random() * Math.PI * 2,
      film: Math.random() * 360,
      age: 0,
    });
  }
}

function pop(env: Env, i: number) {
  const b = bubbles[i];
  env.cue('pop', b.x, b.r / 30);
  pops.push({ x: b.x, y: b.y, r: b.r, age: 0 });
  bubbles[i] = bubbles[bubbles.length - 1];
  bubbles.pop();
  env.budget.give(1);
}

export const soapBubbles: Effect<S> = {
  id: 'bubbles',
  name: 'Soap bubbles',
  blurb: 'Press and hold to blow bubbles. Touch them to pop them.',
  category: 'click',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'size', label: 'Bubble size', min: 10, max: 60, step: 2, default: 28 },
    { kind: 'range', key: 'amount', label: 'Amount', min: 1, max: 10, step: 1, default: 5 },
    { kind: 'range', key: 'tint', label: 'Rainbow shine', min: 0, max: 10, step: 1, default: 6 },
  ],

  setup() {
    carry = 0;
  },

  onPointerDown(env, s) {
    blow(env, s, 2 + Math.round(s.amount / 2));
  },

  update(dt, env, s) {
    const p = env.pointer;
    if (p.down && p.inside) {
      carry += s.amount * 3 * dt;
      const n = Math.floor(carry);
      if (n) {
        carry -= n;
        blow(env, s, n);
      }
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += dt;
      b.wobble += dt * 3;
      b.film += dt * 40;
      // Bubbles drift up, and away from whichever way a phone is tipped.
      const hit = blastAt(env.blasts, b.x, b.y);
      b.vx = b.vx * Math.pow(0.5, dt) + (Math.sin(b.wobble * 0.7) * 12 - env.tilt.x * 40 + hit.fx * 0.5) * dt;
      b.vy = b.vy * Math.pow(0.5, dt) - (18 + env.tilt.y * 14 - hit.fy * 0.5) * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const gone = b.y < -b.r * 2 || b.age > 14;
      // Pop on touch (not while still blowing them out of the wand).
      const touched =
        (p.inside && !p.down && b.age > 0.4 && Math.hypot(p.x - b.x, p.y - b.y) < b.r) ||
        // Shockwaves, fireworks, and shooting stars pop bubbles too.
        (b.age > 0.2 && hit.push > 1200);
      if (touched) pop(env, i);
      else if (gone) {
        bubbles[i] = bubbles[bubbles.length - 1];
        bubbles.pop();
        env.budget.give(1);
      }
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].age += dt;
      if (pops[i].age > 0.35) pops.splice(i, 1);
    }
  },

  draw(env, s) {
    const ctx = env.front;
    const shine = s.tint / 10;
    for (const b of bubbles) {
      const sx = 1 + Math.sin(b.wobble) * 0.04;
      const sy = 1 - Math.sin(b.wobble) * 0.04;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(sx, sy);
      // Thin, see-through body.
      const body = ctx.createRadialGradient(0, 0, b.r * 0.6, 0, 0, b.r);
      body.addColorStop(0, 'rgba(255,255,255,0.02)');
      body.addColorStop(1, `hsla(${b.film},90%,75%,${0.12 + shine * 0.2})`);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.fill();
      // Rainbow film along the rim.
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `hsla(${b.film + k * 70},100%,70%,${0.2 + shine * 0.5})`;
        ctx.beginPath();
        ctx.arc(0, 0, b.r - k * 1.2, k * 2, k * 2 + Math.PI * 1.3);
        ctx.stroke();
      }
      // Window highlight.
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(-b.r * 0.38, -b.r * 0.42, b.r * 0.18, b.r * 0.1, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Pops: a quick ring of droplets.
    ctx.fillStyle = 'rgba(220,240,255,0.9)';
    for (const p of pops) {
      const t = p.age / 0.35;
      const r = p.r * (1 + t * 0.6);
      ctx.globalAlpha = 1 - t;
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  teardown(env) {
    env.budget.give(bubbles.length);
    bubbles.length = 0;
    pops.length = 0;
  },
};
