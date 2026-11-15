import type { Effect } from '../engine/types';

type S = { ribbons: number; speed: number; shine: number };

// Silk ribbons: long, slowly waving bands made of many fine threads. Where a
// ribbon twists, its threads bunch together into a bright fold, which gives
// the silky sheen. Colors drift slowly along each ribbon, and ribbons near
// the cursor bend gently toward it.

let px = 0.5;
let py = 0.5;
let near = 0;

const THREADS = 30;
const STEP = 14;

export const silk: Effect<S> = {
  id: 'silk',
  name: 'Silk ribbons',
  blurb: 'Shimmering ribbons of light wave slowly and bend toward you.',
  category: 'trippy',
  layer: 'back',
  settings: [
    { kind: 'range', key: 'ribbons', label: 'Ribbons', min: 1, max: 5, step: 1, default: 3 },
    { kind: 'range', key: 'speed', label: 'Flow speed', min: 1, max: 10, step: 1, default: 3 },
    { kind: 'range', key: 'shine', label: 'Shine', min: 1, max: 10, step: 1, default: 6 },
  ],

  setup() {
    near = 0;
  },

  update(dt, env) {
    const p = env.pointer;
    const ease = Math.min(1, dt * 3);
    px += (p.x / env.width - px) * ease;
    py += (p.y / env.height - py) * ease;
    near += ((p.inside ? 1 : 0) - near) * Math.min(1, dt * 2);
  },

  draw(env, s) {
    const ctx = env.back;
    const { width: W, height: H } = env;
    const t = env.time * s.speed * 0.15;
    const n = Math.round(s.ribbons);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.3;
    const threadAlpha = 0.05 + s.shine * 0.016;

    for (let r = 0; r < n; r++) {
      const phase = r * 2.1;
      const base = H * (0.25 + (0.5 * (r + 0.5)) / n);
      const hue = (r * 70 + env.time * 8) % 360;
      // A rainbow that slides along the ribbon.
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      for (let k = 0; k <= 4; k++) grad.addColorStop(k / 4, `hsl(${hue + k * 40},95%,70%)`);
      ctx.strokeStyle = grad;
      ctx.globalAlpha = threadAlpha;

      for (let i = 0; i < THREADS; i++) {
        const u = i / (THREADS - 1) - 0.5;
        ctx.beginPath();
        for (let x = -STEP; x <= W + STEP; x += STEP) {
          const fx = x / W;
          let y =
            base +
            Math.sin(fx * 4.2 + t + phase) * H * 0.08 +
            Math.sin(fx * 9.1 - t * 1.3 + phase * 2) * H * 0.03;
          // Bend toward the cursor.
          const pull = Math.exp(-((fx - px) ** 2) / 0.03) * near;
          y += (py * H - y) * pull * 0.25;
          // Width and twist: cos() passing through zero makes a fold.
          const width = H * (0.09 + 0.05 * Math.sin(fx * 3 + t * 0.7 + phase));
          const twist = Math.cos(fx * 5.5 - t * 0.9 + phase);
          const yy = y + u * width * twist;
          if (x === -STEP) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
  },

  teardown() {},
};
