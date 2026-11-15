import type { Effect } from '../engine/types';
import { hexToRgb } from './lib/color';

type S = { color: string; height: number; speed: number };

// Northern lights. Curtains of light ripple slowly across the sky, and the
// curtain nearest your cursor bends toward it and brightens. Drawn small and
// stretched up smoothly, which gives the soft glow for free and keeps it fast.

let scratch: HTMLCanvasElement | null = null;
let px = 0.5;
let py = 0.5;
let near = 0;

const SCALE = 6; // draw small, then stretch up smoothly for a soft glow

export const aurora: Effect<S> = {
  id: 'aurora',
  name: 'Aurora',
  blurb: 'Soft northern lights ripple across the sky and lean toward you.',
  category: 'background',
  layer: 'back',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#4dffb0' },
    { kind: 'range', key: 'height', label: 'Height', min: 20, max: 80, step: 5, default: 50, unit: '%' },
    { kind: 'range', key: 'speed', label: 'Speed', min: 1, max: 10, step: 1, default: 3 },
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
    const w = Math.ceil(env.width / SCALE);
    const h = Math.ceil(env.height / SCALE);
    scratch ??= document.createElement('canvas');
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w;
      scratch.height = h;
    }
    const g = scratch.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';

    const [r, gr, b] = hexToRgb(s.color);
    // A second, cooler tint for the tops of the curtains.
    const top = `rgba(${Math.round(r * 0.5 + 60)},${Math.round(gr * 0.4 + 40)},${Math.min(255, b + 140)},`;
    const base = `rgba(${r},${gr},${b},`;
    const t = env.time * s.speed * 0.12;
    const reach = (s.height / 100) * h;
    const curtains = 3;

    for (let c = 0; c < curtains; c++) {
      const baseY = h * (0.38 + c * 0.12);
      const grad = g.createLinearGradient(0, baseY - reach, 0, baseY + 6);
      grad.addColorStop(0, top + '0)');
      grad.addColorStop(0.55, top + '0.35)');
      grad.addColorStop(0.9, base + '0.75)');
      grad.addColorStop(1, base + '0)');
      g.fillStyle = grad;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        // Layered slow waves give the curtain its folds.
        const wave =
          Math.sin(u * 6 + t * (1 + c * 0.3) + c * 2) * 0.5 +
          Math.sin(u * 13 - t * 1.7 + c) * 0.25 +
          Math.sin(u * 29 + t * 2.3) * 0.12;
        // Lean toward the cursor.
        const pull = Math.exp(-((u - px) ** 2) / 0.02) * near;
        const y = baseY + wave * h * 0.06 + (py * h - baseY) * pull * 0.35;
        // The curtain height changes slowly so its top edge stays smooth.
        // Fine rays only change brightness, which gives soft vertical streaks.
        const swell = 0.5 + 0.5 * Math.sin(u * 5 - t * 0.8 + c * 3);
        const len = reach * (0.65 + 0.35 * swell) * (1 + pull * 0.4);
        const ray = 0.6 + 0.4 * Math.sin(u * 70 + t * 2 + c * 5) * Math.sin(u * 23 - t * 1.3);
        g.globalAlpha = (0.3 + 0.7 * ray) * (0.75 + pull * 0.5) * (1 - c * 0.2);
        g.fillRect(x, y - len, 1, len + 6);
      }
    }

    const ctx = env.back;
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(scratch, 0, 0, w * SCALE, h * SCALE);
  },

  teardown() {},
};
