import type { Effect } from '../engine/types';

type S = { arms: number; twist: number; speed: number };

// Rainbow spiral arms that turn around your cursor. Colors flow outward
// along each arm. It turns smoothly and never flashes.
let cx = 0;
let cy = 0;
let scratch: HTMLCanvasElement | null = null;

export const spiral: Effect<S> = {
  id: 'spiral',
  name: 'Hypno spiral',
  blurb: 'Rainbow spiral arms turn slowly around your cursor.',
  category: 'trippy',
  layer: 'back',
  settings: [
    { kind: 'range', key: 'arms', label: 'Arms', min: 2, max: 12, step: 1, default: 6 },
    { kind: 'range', key: 'twist', label: 'Twist', min: 1, max: 10, step: 1, default: 5 },
    { kind: 'range', key: 'speed', label: 'Spin speed', min: 0, max: 10, step: 1, default: 3 },
  ],

  setup(env) {
    cx = env.width / 2;
    cy = env.height / 2;
  },

  update(dt, env) {
    const p = env.pointer;
    const ease = Math.min(1, dt * 3);
    cx += ((p.inside ? p.x : env.width / 2) - cx) * ease;
    cy += ((p.inside ? p.y : env.height / 2) - cy) * ease;
  },

  draw(env, s) {
    // Drawn solid on a scratch canvas, then laid down see-through in one go,
    // so overlapping segment ends do not show as beads.
    const { width: W, height: H, dpr } = env;
    scratch ??= document.createElement('canvas');
    if (scratch.width !== Math.round(W * dpr) || scratch.height !== Math.round(H * dpr)) {
      scratch.width = Math.round(W * dpr);
      scratch.height = Math.round(H * dpr);
    }
    const ctx = scratch.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const t = env.time;
    const maxR = Math.hypot(env.width, env.height);
    const arms = Math.round(s.arms);
    const twist = s.twist * 0.004;
    const spin = t * s.speed * 0.25;
    const steps = 70;
    ctx.lineCap = 'round';
    for (let a = 0; a < arms; a++) {
      const base = (a / arms) * Math.PI * 2;
      let px = cx;
      let py = cy;
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const r = k * k * maxR;
        const ang = base + r * twist - spin;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        ctx.strokeStyle = `hsl(${(a * (360 / arms) + r * 0.35 - t * 40) % 360},100%,60%)`;
        ctx.lineWidth = 1 + k * 26;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
        px = x;
        py = y;
      }
    }
    env.back.globalAlpha = 0.55;
    env.back.drawImage(scratch, 0, 0, W, H);
  },

  teardown() {},
};
