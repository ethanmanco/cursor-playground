import type { Effect } from '../engine/types';

type S = { amount: number; power: number; size: number };

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  w: number;
  h: number;
  color: string;
  life: number;
}

const COLORS = ['#ff7ad9', '#6ee7ff', '#ffd166', '#8affc1', '#b28cff', '#ff8f70'];
const LIFE = 4;
const pieces: Piece[] = [];

export const confetti: Effect<S> = {
  id: 'confetti',
  name: 'Confetti pop',
  blurb: 'Click or tap to throw a handful of fluttering confetti.',
  category: 'click',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'amount', label: 'Amount', min: 20, max: 200, step: 10, default: 90 },
    { kind: 'range', key: 'power', label: 'Power', min: 1, max: 10, step: 1, default: 6 },
    { kind: 'range', key: 'size', label: 'Piece size', min: 4, max: 20, step: 1, default: 10 },
  ],

  setup() {},

  onPointerDown(env, s) {
    const { x, y } = env.pointer;
    const n = env.budget.take(s.amount);
    for (let i = 0; i < n; i++) {
      // Mostly upward, in a wide cone.
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const v = s.power * 90 * (0.4 + Math.random() * 0.6);
      const w = s.size * (0.6 + Math.random() * 0.6);
      pieces.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 12,
        flip: Math.random() * Math.PI,
        flipSpeed: 6 + Math.random() * 8,
        w,
        h: w * 0.45,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: LIFE * (0.7 + Math.random() * 0.3),
      });
    }
  },

  update(dt, env) {
    const drag = Math.pow(0.975, dt * 60);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const c = pieces[i];
      c.life -= dt;
      if (c.life <= 0 || c.y > env.height + 40) {
        pieces[i] = pieces[pieces.length - 1];
        pieces.pop();
        env.budget.give(1);
        continue;
      }
      // Tilting a phone tips gravity sideways.
      c.vx = c.vx * drag + env.tilt.x * 380 * dt;
      c.vy = c.vy * drag + (420 + env.tilt.y * 180) * dt;
      // Flat pieces catch the air and sway side to side.
      c.x += (c.vx + Math.sin(c.flip) * 30) * dt;
      c.y += c.vy * dt;
      c.angle += c.spin * dt;
      c.flip += c.flipSpeed * dt;
    }
  },

  draw(env) {
    const ctx = env.front;
    for (const c of pieces) {
      ctx.globalAlpha = Math.min(1, c.life / 0.6);
      ctx.fillStyle = c.color;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(c.x * env.dpr, c.y * env.dpr);
      ctx.rotate(c.angle);
      ctx.scale(env.dpr, env.dpr * Math.cos(c.flip));
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    }
  },

  teardown(env) {
    env.budget.give(pieces.length);
    pieces.length = 0;
  },
};
