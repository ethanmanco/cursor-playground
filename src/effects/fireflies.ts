import type { Effect } from '../engine/types';
import { glowSprite } from './lib/color';

type S = { color: string; count: number; trust: number };

// Fireflies wander and glow softly. Hold your cursor still and they drift
// over to gather around it. Move fast and they scatter.

interface Fly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  phase: number;
  rate: number;
}

const flies: Fly[] = [];
let sprite: HTMLCanvasElement | null = null;
let spriteColor = '';
let calm = 0; // 0 when moving fast, 1 after holding still a moment

export const fireflies: Effect<S> = {
  id: 'fireflies',
  name: 'Fireflies',
  blurb: 'Hold still and fireflies gather around you. Move fast to scatter them.',
  category: 'followers',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Glow', default: '#d8ff6b' },
    { kind: 'range', key: 'count', label: 'Fireflies', min: 10, max: 80, step: 5, default: 35 },
    { kind: 'range', key: 'trust', label: 'Friendliness', min: 1, max: 10, step: 1, default: 6 },
  ],

  setup() {
    flies.length = 0;
    calm = 0;
  },

  update(dt, env, s) {
    const want = Math.round(s.count * (matchMedia('(pointer: coarse)').matches ? 0.6 : 1));
    while (flies.length < want) {
      flies.push({
        x: Math.random() * env.width,
        y: Math.random() * env.height,
        vx: 0,
        vy: 0,
        heading: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        rate: 0.6 + Math.random() * 0.9,
      });
    }
    flies.length = want;

    const p = env.pointer;
    const speed = Math.hypot(p.vx, p.vy);
    const target = p.inside && speed < 60 ? 1 : 0;
    calm += (target - calm) * Math.min(1, dt * (target ? 0.8 : 6));

    for (const f of flies) {
      // Wander: the heading drifts randomly.
      f.heading += (Math.random() - 0.5) * 4 * dt;
      let ax = Math.cos(f.heading) * 40;
      let ay = Math.sin(f.heading) * 40;
      if (p.inside) {
        const dx = p.x - f.x;
        const dy = p.y - f.y;
        const d = Math.hypot(dx, dy) || 1;
        if (speed > 500 && d < 220) {
          // Startled.
          ax -= (dx / d) * 900;
          ay -= (dy / d) * 900;
        } else if (calm > 0.2 && d > 40) {
          const pull = calm * s.trust * 14;
          ax += (dx / d) * pull;
          ay += (dy / d) * pull;
        }
      }
      f.vx = (f.vx + ax * dt) * Math.pow(0.4, dt);
      f.vy = (f.vy + ay * dt) * Math.pow(0.4, dt);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < -20) f.x = env.width + 20;
      else if (f.x > env.width + 20) f.x = -20;
      if (f.y < -20) f.y = env.height + 20;
      else if (f.y > env.height + 20) f.y = -20;
    }
  },

  draw(env, s) {
    if (!sprite || spriteColor !== s.color) {
      sprite = glowSprite(s.color, 48);
      spriteColor = s.color;
    }
    const ctx = env.front;
    ctx.globalCompositeOperation = 'lighter';
    for (const f of flies) {
      // A slow, soft pulse (well under once a second), never a flash.
      const glow = 0.25 + 0.75 * Math.max(0, Math.sin(env.time * f.rate + f.phase)) ** 2;
      const r = 6 + glow * 10;
      ctx.globalAlpha = glow;
      ctx.drawImage(sprite, f.x - r, f.y - r, r * 2, r * 2);
    }
  },

  teardown() {
    flies.length = 0;
  },
};
