import type { Effect } from '../engine/types';
import { glowSprite, hexToHue } from './lib/color';

type S = { color: string; moons: number; speed: number };

// Little moons circle your cursor on tilted orbits, each leaving a short
// glowing trail. Moving drags the whole system along behind you.

interface Moon {
  radius: number;
  tilt: number;
  squash: number;
  speed: number;
  angle: number;
  size: number;
  trail: { x: number; y: number }[];
}

const moons: Moon[] = [];
let cx = 0;
let cy = 0;
let sprite: HTMLCanvasElement | null = null;
let spriteColor = '';

export const orbit: Effect<S> = {
  id: 'orbit',
  name: 'Orbiting moons',
  blurb: 'Little moons circle your cursor and trail along behind you.',
  category: 'followers',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#9ec5ff' },
    { kind: 'range', key: 'moons', label: 'Moons', min: 1, max: 8, step: 1, default: 4 },
    { kind: 'range', key: 'speed', label: 'Orbit speed', min: 1, max: 10, step: 1, default: 4 },
  ],

  setup(env) {
    moons.length = 0;
    cx = env.pointer.x;
    cy = env.pointer.y;
  },

  update(dt, env, s) {
    const want = Math.round(s.moons);
    while (moons.length < want) {
      const i = moons.length;
      moons.push({
        radius: 30 + i * 18 + Math.random() * 6,
        tilt: Math.random() * Math.PI,
        squash: 0.35 + Math.random() * 0.4,
        speed: (1.6 - i * 0.12) * (i % 2 ? -1 : 1),
        angle: Math.random() * Math.PI * 2,
        size: 4 + Math.random() * 3,
        trail: [],
      });
    }
    moons.length = want;

    const ease = Math.min(1, dt * 6);
    cx += (env.pointer.x - cx) * ease;
    cy += (env.pointer.y - cy) * ease;

    for (const m of moons) {
      m.angle += m.speed * s.speed * 0.35 * dt;
      const ex = Math.cos(m.angle) * m.radius;
      const ey = Math.sin(m.angle) * m.radius * m.squash;
      const x = cx + ex * Math.cos(m.tilt) - ey * Math.sin(m.tilt);
      const y = cy + ex * Math.sin(m.tilt) + ey * Math.cos(m.tilt);
      m.trail.unshift({ x, y });
      if (m.trail.length > 18) m.trail.length = 18;
    }
  },

  draw(env, s) {
    if (!env.pointer.inside) return;
    if (!sprite || spriteColor !== s.color) {
      sprite = glowSprite(s.color, 48);
      spriteColor = s.color;
    }
    const ctx = env.front;
    const hue = hexToHue(s.color);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    moons.forEach((m, i) => {
      const n = m.trail.length;
      for (let k = n - 1; k > 0; k--) {
        const t = 1 - k / n;
        ctx.strokeStyle = `hsla(${hue + i * 18},100%,70%,${t * 0.5})`;
        ctx.lineWidth = m.size * t * 1.4;
        ctx.beginPath();
        ctx.moveTo(m.trail[k].x, m.trail[k].y);
        ctx.lineTo(m.trail[k - 1].x, m.trail[k - 1].y);
        ctx.stroke();
      }
      const head = m.trail[0];
      if (!head) return;
      const r = m.size * 3;
      ctx.drawImage(sprite!, head.x - r, head.y - r, r * 2, r * 2);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, m.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  teardown() {
    moons.length = 0;
  },
};
