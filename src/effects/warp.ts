import type { Effect } from '../engine/types';
import { rgba } from './lib/color';

type S = { color: string; speed: number; count: number };

interface Star {
  x: number; // -1..1, scaled by screen size when drawn
  y: number;
  z: number; // 1 is far away, 0 is right at your eye
  pz: number;
}

// Stars fly toward you from a vanishing point that follows your cursor.
// Moving the cursor fast kicks in an extra burst of speed.
const stars: Star[] = [];
let cx = 0;
let cy = 0;
let boost = 0;

const fresh = (z = 1): Star => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z, pz: z });

export const warp: Effect<S> = {
  id: 'warp',
  name: 'Starfield warp',
  blurb: 'Fly through space toward your cursor. Move fast to boost.',
  category: 'background',
  layer: 'back',
  settings: [
    { kind: 'color', key: 'color', label: 'Star color', default: '#cfe3ff' },
    { kind: 'range', key: 'speed', label: 'Speed', min: 1, max: 10, step: 1, default: 4 },
    { kind: 'range', key: 'count', label: 'Stars', min: 50, max: 400, step: 10, default: 200 },
  ],

  setup(env) {
    stars.length = 0;
    cx = env.width / 2;
    cy = env.height / 2;
    boost = 0;
  },

  update(dt, env, s) {
    const want = Math.round(s.count * (matchMedia('(pointer: coarse)').matches ? 0.5 : 1));
    while (stars.length < want) stars.push(fresh(0.05 + Math.random() * 0.95));
    stars.length = want;

    const p = env.pointer;
    const tx = p.inside ? p.x : env.width / 2;
    const ty = p.inside ? p.y : env.height / 2;
    const ease = Math.min(1, dt * 2.5);
    cx += (tx - cx) * ease;
    cy += (ty - cy) * ease;

    const kick = Math.min(3, Math.hypot(p.vx, p.vy) / 700);
    boost += (kick - boost) * Math.min(1, dt * (kick > boost ? 6 : 1.5));

    const dz = s.speed * 0.09 * (1 + boost) * dt;
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      st.pz = st.z;
      st.z -= dz;
      if (st.z <= 0.02) stars[i] = fresh();
    }
  },

  draw(env, s) {
    const ctx = env.back;
    const hw = env.width;
    const hh = env.height;
    ctx.lineCap = 'round';
    for (const st of stars) {
      const x = cx + (st.x / st.z) * hw * 0.5;
      const y = cy + (st.y / st.z) * hh * 0.5;
      if (x < -50 || x > hw + 50 || y < -50 || y > hh + 50) {
        st.z = 0; // off screen: respawn next frame
        continue;
      }
      const px = cx + (st.x / st.pz) * hw * 0.5;
      const py = cy + (st.y / st.pz) * hh * 0.5;
      const near = 1 - st.z;
      ctx.strokeStyle = rgba(s.color, Math.min(1, 0.3 + near * 1.1));
      ctx.lineWidth = 1 + near * 2.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x + 0.01, y);
      ctx.stroke();
    }
  },

  teardown() {
    stars.length = 0;
  },
};
