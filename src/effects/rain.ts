import type { Effect } from '../engine/types';
import { blastAt } from '../engine/blasts';
import { arrowPath } from './lib/arrow';

type S = { amount: number; size: number; bounce: number };

// Cursor rain: click or tap and a handful of tiny cursors pop out, tumble
// through the air, and bounce along the bottom of the screen before fading.

interface Mini {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  hue: number;
  life: number;
  size: number;
}

const minis: Mini[] = [];

export const cursorRain: Effect<S> = {
  id: 'rain',
  name: 'Cursor rain',
  blurb: 'Click or tap to burst out tiny cursors that tumble and bounce.',
  category: 'click',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'amount', label: 'Amount', min: 5, max: 40, step: 1, default: 16 },
    { kind: 'range', key: 'size', label: 'Size', min: 8, max: 24, step: 1, default: 13 },
    { kind: 'range', key: 'bounce', label: 'Bounce', min: 1, max: 10, step: 1, default: 6 },
  ],

  setup() {},

  onPointerDown(env, s) {
    const { x, y } = env.pointer;
    const n = env.budget.take(s.amount);
    env.cue('confetti', x, 0.6);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 250 + Math.random() * 350;
      minis.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        angle: (Math.random() - 0.5) * 1,
        spin: (Math.random() - 0.5) * 10,
        hue: Math.random() * 360,
        life: 4 + Math.random() * 1.5,
        size: s.size * (0.75 + Math.random() * 0.5),
      });
    }
  },

  update(dt, env, s) {
    const floor = env.height - 6;
    const restitution = 0.25 + s.bounce * 0.06;
    for (let i = minis.length - 1; i >= 0; i--) {
      const m = minis[i];
      m.life -= dt;
      if (m.life <= 0) {
        minis[i] = minis[minis.length - 1];
        minis.pop();
        env.budget.give(1);
        continue;
      }
      const hit = blastAt(env.blasts, m.x, m.y);
      m.vx += (env.tilt.x * 300 + hit.fx) * dt;
      m.vy += (700 + env.tilt.y * 200 + hit.fy) * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.angle += m.spin * dt;
      if (m.y > floor) {
        m.y = floor;
        m.vy *= -restitution;
        m.vx *= 0.8;
        m.spin *= 0.6;
      }
      if (m.x < 0 || m.x > env.width) {
        m.x = Math.min(env.width, Math.max(0, m.x));
        m.vx *= -0.7;
      }
    }
  },

  draw(env) {
    const ctx = env.front;
    ctx.lineJoin = 'round';
    for (const m of minis) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, m.life / 0.8);
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      ctx.fillStyle = `hsl(${m.hue},95%,68%)`;
      ctx.strokeStyle = 'rgba(5,6,15,0.7)';
      ctx.lineWidth = 1;
      arrowPath(ctx, -m.size * 0.35, -m.size * 0.5, m.size);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  },

  teardown(env) {
    env.budget.give(minis.length);
    minis.length = 0;
  },
};
