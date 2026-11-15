import type { Effect } from '../engine/types';
import { glowSprite, rgba } from './lib/color';

type S = { color: string; amount: number; length: number };

// Shooting stars streak across the sky now and then. Click or tap to make a
// wish: a little shower bursts out from that spot.

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const meteors: Meteor[] = [];
const dust: Dust[] = [];
let wait = 0.5;
let sprite: HTMLCanvasElement | null = null;
let spriteColor = '';

function launch(x: number, y: number, angle: number, speed: number) {
  const max = 0.9 + Math.random() * 0.8;
  meteors.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: max, max });
}

export const shootingStars: Effect<S> = {
  id: 'meteors',
  name: 'Shooting stars',
  blurb: 'Shooting stars streak by. Click to make a wish and start a shower.',
  category: 'background',
  layer: 'back',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#fff3cf' },
    { kind: 'range', key: 'amount', label: 'How often', min: 1, max: 10, step: 1, default: 4 },
    { kind: 'range', key: 'length', label: 'Tail length', min: 1, max: 10, step: 1, default: 5 },
  ],

  setup() {
    meteors.length = 0;
    wait = 0.5;
  },

  onPointerDown(env) {
    const { x, y } = env.pointer;
    env.cue('wish', x);
    const n = 4 + Math.floor(Math.random() * 3);
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) launch(x, y, base + (i / n) * Math.PI * 2 + Math.random() * 0.3, 450 + Math.random() * 350);
  },

  update(dt, env, s) {
    wait -= dt;
    if (wait <= 0) {
      wait = (0.4 + Math.random() * 1.6) * (11 - s.amount) * 0.35;
      // Enter from the top or a side, heading down and across.
      const fromLeft = Math.random() < 0.5;
      const x = Math.random() * env.width;
      launch(x, -20, fromLeft ? 0.45 + Math.random() * 0.5 : Math.PI - 0.45 - Math.random() * 0.5, 700 + Math.random() * 500);
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life -= dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.life <= 0) {
        meteors.splice(i, 1);
        continue;
      }
      // A meteor's head is small but hard: it pops bubbles in its path.
      env.blast({ x: m.x, y: m.y, radius: 22, strength: 2500, kind: 'push' });
      // Shed a little glittering dust.
      if (Math.random() < 0.5 && env.budget.take(1)) {
        dust.push({ x: m.x, y: m.y, vx: m.vx * 0.05 + (Math.random() - 0.5) * 30, vy: m.vy * 0.05 + (Math.random() - 0.5) * 30, life: 0.5 + Math.random() * 0.5 });
      }
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.life -= dt;
      if (d.life <= 0) {
        dust[i] = dust[dust.length - 1];
        dust.pop();
        env.budget.give(1);
        continue;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
  },

  draw(env, s) {
    if (!sprite || spriteColor !== s.color) {
      sprite = glowSprite(s.color, 48);
      spriteColor = s.color;
    }
    const ctx = env.back;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const m of meteors) {
      const fade = Math.min(1, m.life / (m.max * 0.4));
      const tail = 0.03 + s.length * 0.018;
      const tx = m.x - m.vx * tail;
      const ty = m.y - m.vy * tail;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, rgba(s.color, 0.95 * fade));
      g.addColorStop(1, rgba(s.color, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.drawImage(sprite, m.x - 10, m.y - 10, 20, 20);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = rgba(s.color, 0.8);
    for (const d of dust) {
      ctx.globalAlpha = d.life;
      ctx.fillRect(d.x - 0.8, d.y - 0.8, 1.6, 1.6);
    }
  },

  teardown(env) {
    env.budget.give(dust.length);
    dust.length = 0;
    meteors.length = 0;
  },
};
