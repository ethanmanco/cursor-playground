import type { Effect } from '../engine/types';
import { glowSprite, rgba } from './lib/color';

type S = { color: string; size: number; tail: number };

// The head chases the cursor on a spring, and the tail is its recent path.
const path: { x: number; y: number }[] = [];
let hx = 0;
let hy = 0;
let vx = 0;
let vy = 0;
let sprite: HTMLCanvasElement | null = null;
let spriteColor = '';

export const comet: Effect<S> = {
  id: 'comet',
  name: 'Glowing comet',
  blurb: 'A bright comet chases your cursor on a spring.',
  category: 'followers',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#ffd166' },
    { kind: 'range', key: 'size', label: 'Size', min: 6, max: 40, step: 1, default: 18 },
    { kind: 'range', key: 'tail', label: 'Tail length', min: 5, max: 60, step: 1, default: 30 },
  ],

  setup(env) {
    hx = env.pointer.x;
    hy = env.pointer.y;
    vx = vy = 0;
    path.length = 0;
  },

  update(dt, env, s) {
    const p = env.pointer;
    const k = 90;
    const damping = 11;
    vx += ((p.x - hx) * k - vx * damping) * dt;
    vy += ((p.y - hy) * k - vy * damping) * dt;
    hx += vx * dt;
    hy += vy * dt;
    path.unshift({ x: hx, y: hy });
    if (path.length > s.tail) path.length = s.tail;
  },

  draw(env, s) {
    if (!sprite || spriteColor !== s.color) {
      sprite = glowSprite(s.color, 96);
      spriteColor = s.color;
    }
    const ctx = env.front;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const n = path.length;
    for (let i = n - 1; i > 0; i--) {
      const t = 1 - i / n;
      ctx.strokeStyle = rgba(s.color, t * 0.7);
      ctx.lineWidth = s.size * 0.8 * t;
      ctx.beginPath();
      ctx.moveTo(path[i].x, path[i].y);
      ctx.lineTo(path[i - 1].x, path[i - 1].y);
      ctx.stroke();
    }
    const r = s.size * 1.6;
    ctx.drawImage(sprite, hx - r, hy - r, r * 2, r * 2);
  },

  teardown() {
    path.length = 0;
  },
};
