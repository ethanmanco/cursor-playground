import type { Effect } from '../engine/types';

type S = { size: number; fade: number; speed: number };

interface Stroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hue: number;
  born: number;
}

// Strokes are kept as short segments and redrawn each frame, so they fade
// cleanly and survive window resizes.
const strokes: Stroke[] = [];
let hue = 0;

const cap = () => (matchMedia('(pointer: coarse)').matches ? 700 : 1800);

export const paint: Effect<S> = {
  id: 'paint',
  name: 'Rainbow paint',
  blurb: 'Paint with a brush that cycles through the rainbow.',
  category: 'drawing',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'size', label: 'Brush size', min: 2, max: 40, step: 1, default: 12 },
    { kind: 'range', key: 'fade', label: 'Fade time', min: 1, max: 20, step: 1, default: 5, unit: 's' },
    { kind: 'range', key: 'speed', label: 'Rainbow speed', min: 0, max: 10, step: 1, default: 4 },
  ],

  setup() {
    strokes.length = 0;
  },

  update(dt, env, s) {
    const p = env.pointer;
    const dist = Math.hypot(p.x - p.px, p.y - p.py);
    if (p.inside && dist > 0.5) {
      strokes.push({ x1: p.px, y1: p.py, x2: p.x, y2: p.y, hue, born: env.time });
      hue = (hue + dist * s.speed * 0.08 + dt * s.speed * 6) % 360;
    }
    let drop = 0;
    while (drop < strokes.length && env.time - strokes[drop].born > s.fade) drop++;
    const over = strokes.length - drop - cap();
    if (over > 0) drop += over;
    if (drop) strokes.splice(0, drop);
  },

  draw(env, s) {
    const ctx = env.front;
    ctx.lineCap = 'round';
    for (const k of strokes) {
      const t = 1 - (env.time - k.born) / s.fade;
      if (t <= 0) continue;
      ctx.strokeStyle = `hsla(${k.hue},100%,64%,${t})`;
      ctx.lineWidth = s.size * (0.35 + 0.65 * t);
      ctx.beginPath();
      ctx.moveTo(k.x1, k.y1);
      ctx.lineTo(k.x2, k.y2);
      ctx.stroke();
    }
  },

  teardown() {
    strokes.length = 0;
  },
};
