import type { Effect } from '../engine/types';

type S = { color: string; spacing: number; opacity: number };

// Op art: two sets of ring bands, one centered on your cursor and one
// circling the middle of the screen. Where they overlap they cancel out
// (XOR), and wavy interference patterns appear.
let scratch: HTMLCanvasElement | null = null;
let cx = 0;
let cy = 0;

function bands(ctx: CanvasRenderingContext2D, x: number, y: number, spacing: number, maxR: number) {
  ctx.beginPath();
  for (let r = spacing; r < maxR; r += spacing * 2) {
    ctx.moveTo(x + r + spacing, y);
    ctx.arc(x, y, r + spacing, 0, Math.PI * 2);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2, true);
  }
  ctx.fill();
}

export const moire: Effect<S> = {
  id: 'moire',
  name: 'Moire rings',
  blurb: 'Two sets of rings overlap into wobbly op art patterns.',
  category: 'trippy',
  layer: 'back',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#b28cff' },
    { kind: 'range', key: 'spacing', label: 'Ring spacing', min: 4, max: 24, step: 1, default: 9 },
    { kind: 'range', key: 'opacity', label: 'Strength', min: 10, max: 80, step: 5, default: 35, unit: '%' },
  ],

  setup(env) {
    cx = env.pointer.x;
    cy = env.pointer.y;
  },

  update(dt, env) {
    const ease = Math.min(1, dt * 8);
    cx += (env.pointer.x - cx) * ease;
    cy += (env.pointer.y - cy) * ease;
  },

  draw(env, s) {
    const { width: W, height: H } = env;
    // One canvas pixel per CSS pixel is plenty for these patterns.
    scratch ??= document.createElement('canvas');
    if (scratch.width !== W || scratch.height !== H) {
      scratch.width = W;
      scratch.height = H;
    }
    const sc = scratch.getContext('2d')!;
    sc.globalCompositeOperation = 'source-over';
    sc.clearRect(0, 0, W, H);
    sc.fillStyle = s.color;
    const maxR = Math.hypot(W, H);
    const t = env.time * 0.25;
    bands(sc, W / 2 + Math.cos(t) * W * 0.12, H / 2 + Math.sin(t * 1.3) * H * 0.12, s.spacing, maxR);
    sc.globalCompositeOperation = 'xor';
    bands(sc, cx, cy, s.spacing, maxR);

    const ctx = env.back;
    ctx.globalAlpha = s.opacity / 100;
    ctx.drawImage(scratch, 0, 0, W, H);
  },

  teardown() {},
};
