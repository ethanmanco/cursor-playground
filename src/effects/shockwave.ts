import type { Effect } from '../engine/types';
import { hexToHue } from './lib/color';

type S = { color: string; size: number; speed: number };

interface Wave {
  x: number;
  y: number;
  age: number;
}

const waves: Wave[] = [];

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export const shockwave: Effect<S> = {
  id: 'shockwave',
  name: 'Shockwave',
  blurb: 'Click or tap to send a glowing ring rushing outward.',
  category: 'click',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#6ee7ff' },
    { kind: 'range', key: 'size', label: 'Size', min: 80, max: 500, step: 20, default: 260 },
    { kind: 'range', key: 'speed', label: 'Speed', min: 1, max: 10, step: 1, default: 5 },
  ],

  setup() {
    waves.length = 0;
  },

  onPointerDown(env) {
    waves.push({ x: env.pointer.x, y: env.pointer.y, age: 0 });
    if (waves.length > 8) waves.shift();
  },

  update(dt, _env, s) {
    const duration = 1.6 - s.speed * 0.12;
    for (const w of waves) w.age += dt / duration;
    while (waves.length && waves[0].age >= 1) waves.shift();
  },

  draw(env, s) {
    const ctx = env.front;
    const hue = hexToHue(s.color);
    ctx.globalCompositeOperation = 'lighter';
    for (const w of waves) {
      const t = Math.min(1, w.age);
      const r = 6 + easeOut(t) * s.size;
      const fade = 1 - t;
      if (t < 0.25) {
        const flash = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, r);
        flash.addColorStop(0, `hsla(${hue},100%,85%,${0.5 * (1 - t / 0.25)})`);
        flash.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Three slightly offset rings in neighboring hues give a prism edge.
      const rings: [number, number][] = [[-30, -4], [0, 0], [30, 4]];
      for (const [shift, dr] of rings) {
        ctx.strokeStyle = `hsla(${hue + shift},100%,${shift ? 62 : 80}%,${fade * 0.9})`;
        ctx.lineWidth = 1.5 + fade * 6;
        ctx.beginPath();
        ctx.arc(w.x, w.y, Math.max(1, r + dr * (1 + t * 2)), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  },

  teardown() {
    waves.length = 0;
  },
};
