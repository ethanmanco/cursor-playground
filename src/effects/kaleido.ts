import type { Effect } from '../engine/types';

type S = { slices: number; size: number; fade: number };

interface Stroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hue: number;
  born: number;
}

// Whatever you draw is mirrored around the center of the screen into a
// slowly turning kaleidoscope. Strokes are drawn once onto a scratch canvas,
// then stamped (and flipped) once per slice, which is cheap for the GPU.
const strokes: Stroke[] = [];
let scratch: HTMLCanvasElement | null = null;
let hue = 0;

const cap = () => (matchMedia('(pointer: coarse)').matches ? 250 : 500);

export const kaleido: Effect<S> = {
  id: 'kaleido',
  name: 'Kaleidoscope',
  blurb: 'Draw, and your lines bloom into a turning mirror pattern.',
  category: 'trippy',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'slices', label: 'Mirrors', min: 3, max: 12, step: 1, default: 8 },
    { kind: 'range', key: 'size', label: 'Brush size', min: 2, max: 24, step: 1, default: 7 },
    { kind: 'range', key: 'fade', label: 'Fade time', min: 2, max: 15, step: 1, default: 6, unit: 's' },
  ],

  setup() {
    strokes.length = 0;
  },

  update(dt, env, s) {
    const p = env.pointer;
    const cx = env.width / 2;
    const cy = env.height / 2;
    const dist = Math.hypot(p.x - p.px, p.y - p.py);
    if (p.inside && dist > 0.5) {
      strokes.push({ x1: p.px - cx, y1: p.py - cy, x2: p.x - cx, y2: p.y - cy, hue, born: env.time });
      hue = (hue + dist * 0.4 + dt * 20) % 360;
    }
    let drop = 0;
    while (drop < strokes.length && env.time - strokes[drop].born > s.fade) drop++;
    drop = Math.max(drop, strokes.length - cap());
    if (drop > 0) strokes.splice(0, drop);
  },

  draw(env, s) {
    if (!strokes.length) return;
    const { width: W, height: H, dpr } = env;
    scratch ??= document.createElement('canvas');
    const w = Math.round(W * dpr);
    const h = Math.round(H * dpr);
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w;
      scratch.height = h;
    }
    const sc = scratch.getContext('2d')!;
    sc.setTransform(dpr, 0, 0, dpr, (W / 2) * dpr, (H / 2) * dpr);
    sc.clearRect(-W / 2, -H / 2, W, H);
    sc.lineCap = 'round';
    for (const k of strokes) {
      const t = 1 - (env.time - k.born) / s.fade;
      if (t <= 0) continue;
      sc.strokeStyle = `hsla(${k.hue},100%,62%,${t})`;
      sc.lineWidth = s.size * (0.4 + 0.6 * t);
      sc.beginPath();
      sc.moveTo(k.x1, k.y1);
      sc.lineTo(k.x2, k.y2);
      sc.stroke();
    }

    const ctx = env.front;
    const n = Math.round(s.slices);
    const spin = env.time * 0.15;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < n; i++) {
      for (const flip of [1, -1]) {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(spin + (i / n) * Math.PI * 2);
        ctx.scale(1, flip);
        ctx.drawImage(scratch, -W / 2, -H / 2, W, H);
        ctx.restore();
      }
    }
  },

  teardown() {
    strokes.length = 0;
  },
};
