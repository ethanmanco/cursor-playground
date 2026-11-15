import type { Effect } from '../engine/types';
import { rgba } from './lib/color';

type S = { color: string; count: number; reach: number };

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const stars: Star[] = [];

function spawn(w: number, h: number): Star {
  const a = Math.random() * Math.PI * 2;
  const speed = 6 + Math.random() * 14;
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    r: 0.8 + Math.random() * 1.6,
  };
}

export const constellation: Effect<S> = {
  id: 'constellation',
  name: 'Constellations',
  blurb: 'Drifting stars link up, and reach out to your cursor.',
  category: 'background',
  layer: 'back',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#9ec5ff' },
    { kind: 'range', key: 'count', label: 'Stars', min: 20, max: 150, step: 5, default: 70 },
    { kind: 'range', key: 'reach', label: 'Link distance', min: 60, max: 220, step: 10, default: 140 },
  ],

  setup() {
    stars.length = 0;
  },

  update(dt, env, s) {
    const want = Math.round(s.count * (matchMedia('(pointer: coarse)').matches ? 0.6 : 1));
    while (stars.length < want) stars.push(spawn(env.width, env.height));
    stars.length = want;
    const { width: W, height: H } = env;
    for (const st of stars) {
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      if (st.x < -20) st.x += W + 40;
      else if (st.x > W + 20) st.x -= W + 40;
      if (st.y < -20) st.y += H + 40;
      else if (st.y > H + 20) st.y -= H + 40;
    }
  },

  draw(env, s) {
    const ctx = env.back;
    const R = s.reach;
    const R2 = R * R;
    ctx.lineWidth = 1;
    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      for (let j = i + 1; j < stars.length; j++) {
        const b = stars[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        ctx.strokeStyle = rgba(s.color, (1 - Math.sqrt(d2) / R) * 0.45);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    const p = env.pointer;
    const reach = R * 1.3;
    for (const st of stars) {
      let glow = 0;
      if (p.inside) {
        const d = Math.hypot(st.x - p.x, st.y - p.y);
        if (d < reach) {
          glow = 1 - d / reach;
          ctx.strokeStyle = rgba(s.color, glow * 0.9);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(st.x, st.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = rgba(s.color, 0.55 + glow * 0.45);
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r + glow * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  teardown() {
    stars.length = 0;
  },
};
