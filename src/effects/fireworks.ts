import type { Effect } from '../engine/types';
import { hexToHue } from './lib/color';

type S = { color: string; sparks: number; power: number };

interface Ember {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  hue: number;
  light: number;
}

interface Flash {
  x: number;
  y: number;
  life: number;
}

const embers: Ember[] = [];
const flashes: Flash[] = [];

export const fireworks: Effect<S> = {
  id: 'fireworks',
  name: 'Firework burst',
  blurb: 'Click or tap anywhere to set off a burst.',
  category: 'click',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#ff7ad9' },
    { kind: 'range', key: 'sparks', label: 'Sparks', min: 20, max: 160, step: 10, default: 80 },
    { kind: 'range', key: 'power', label: 'Power', min: 1, max: 10, step: 1, default: 5 },
  ],

  setup() {},

  onPointerDown(env, s) {
    const { x, y } = env.pointer;
    const n = env.budget.take(s.sparks);
    const base = hexToHue(s.color);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const speed = s.power * 70 * (0.35 + Math.random() * 0.65);
      const max = 0.9 + Math.random() * 0.8;
      embers.push({
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: max,
        max,
        hue: base + (Math.random() - 0.5) * 50,
        // A few white-hot sparks for sparkle.
        light: Math.random() < 0.15 ? 92 : 62,
      });
    }
    flashes.push({ x, y, life: 0.25 });
  },

  update(dt, env) {
    const drag = Math.pow(0.965, dt * 60);
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.life -= dt;
      if (e.life <= 0) {
        embers[i] = embers[embers.length - 1];
        embers.pop();
        env.budget.give(1);
        continue;
      }
      e.px = e.x;
      e.py = e.y;
      e.vx = e.vx * drag + env.tilt.x * 150 * dt;
      e.vy = e.vy * drag + (160 + env.tilt.y * 70) * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].life -= dt;
      if (flashes[i].life <= 0) flashes.splice(i, 1);
    }
  },

  draw(env) {
    const ctx = env.front;
    ctx.globalCompositeOperation = 'lighter';
    for (const f of flashes) {
      const t = f.life / 0.25;
      const r = 10 + (1 - t) * 40;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.8 * t})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    for (const e of embers) {
      const t = e.life / e.max;
      // Twinkle near the end of life.
      const a = t < 0.35 ? t * (0.4 + Math.random() * 0.6) * 2.5 : 1;
      ctx.strokeStyle = `hsla(${e.hue},100%,${e.light}%,${Math.min(1, a)})`;
      ctx.beginPath();
      ctx.moveTo(e.px - (e.x - e.px) * 2, e.py - (e.y - e.py) * 2);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
  },

  teardown(env) {
    env.budget.give(embers.length);
    embers.length = 0;
    flashes.length = 0;
  },
};
