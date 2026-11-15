import type { Effect } from '../engine/types';
import { blastAt } from '../engine/blasts';

type S = { count: number; size: number; wind: number };

// Dandelion seeds float lazily across the screen on a soft breeze. Moving
// your cursor stirs up a gust that carries nearby seeds along with it.

interface Seed {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  scale: number;
  sway: number;
}

const seeds: Seed[] = [];

function spawn(w: number, h: number, anywhere: boolean): Seed {
  return {
    x: anywhere ? Math.random() * w : -20,
    y: Math.random() * h,
    vx: 0,
    vy: 0,
    angle: (Math.random() - 0.5) * 0.6,
    spin: 0,
    scale: 0.7 + Math.random() * 0.6,
    sway: Math.random() * Math.PI * 2,
  };
}

export const dandelionSeeds: Effect<S> = {
  id: 'seeds',
  name: 'Dandelion seeds',
  blurb: 'Seeds float on a soft breeze. Move through them to stir up a gust.',
  category: 'background',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'count', label: 'Seeds', min: 10, max: 80, step: 5, default: 30 },
    { kind: 'range', key: 'size', label: 'Size', min: 6, max: 20, step: 1, default: 11 },
    { kind: 'range', key: 'wind', label: 'Breeze', min: 1, max: 10, step: 1, default: 4 },
  ],

  setup() {
    seeds.length = 0;
  },

  update(dt, env, s) {
    const want = Math.round(s.count * (matchMedia('(pointer: coarse)').matches ? 0.6 : 1));
    while (seeds.length < want) seeds.push(spawn(env.width, env.height, true));
    seeds.length = want;

    const p = env.pointer;
    const breeze = s.wind * 6;
    for (const sd of seeds) {
      sd.sway += dt * 0.8;
      // A steady breeze, with slow up and down drifting.
      let ax = (breeze - sd.vx) * 0.6 + env.tilt.x * 60;
      let ay = Math.sin(sd.sway) * 10 - sd.vy * 0.6 - 4 + env.tilt.y * 40;
      if (p.inside) {
        const dx = sd.x - p.x;
        const dy = sd.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 140 * 140) {
          // The cursor's gust carries seeds along its path.
          const k = 1 - Math.sqrt(d2) / 140;
          ax += p.vx * k * 3;
          ay += p.vy * k * 3;
          sd.spin += (p.vx * 0.002 - sd.spin) * k;
        }
      }
      const hit = blastAt(env.blasts, sd.x, sd.y);
      ax += hit.fx * 0.4;
      ay += hit.fy * 0.4;
      sd.vx += ax * dt;
      sd.vy += ay * dt;
      sd.x += sd.vx * dt;
      sd.y += sd.vy * dt;
      sd.spin *= Math.pow(0.5, dt);
      sd.angle += sd.spin * dt * 60;
      sd.angle += (Math.sin(sd.sway * 1.3) * 0.25 - sd.angle) * Math.min(1, dt * 0.8);
      // Drift off one side, come back from the other.
      if (sd.x > env.width + 30) Object.assign(sd, spawn(env.width, env.height, false));
      else if (sd.x < -40) sd.x = env.width + 20;
      if (sd.y < -30) sd.y = env.height + 20;
      else if (sd.y > env.height + 30) sd.y = -20;
    }
  },

  draw(env, s) {
    const ctx = env.front;
    ctx.lineCap = 'round';
    for (const sd of seeds) {
      const L = s.size * sd.scale;
      ctx.save();
      ctx.translate(sd.x, sd.y);
      ctx.rotate(sd.angle);
      ctx.strokeStyle = 'rgba(240,240,255,0.55)';
      ctx.lineWidth = 0.8;
      // Stem.
      ctx.beginPath();
      ctx.moveTo(0, L * 0.9);
      ctx.lineTo(0, 0);
      ctx.stroke();
      // The fluffy top: fine filaments fanned out in a dome.
      ctx.strokeStyle = 'rgba(240,240,255,0.4)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI / 2 + (k / 8 - 0.5) * 2.6;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * L * 0.7, Math.sin(a) * L * 0.7);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(0, L * 0.9, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  teardown() {
    seeds.length = 0;
  },
};
