import type { Effect } from '../engine/types';

type S = { blobs: number; size: number; speed: number };

// Metaballs: every blob adds to a shared "goo" field, and wherever the field
// is strong enough we paint color. Blobs that drift close melt together. One
// blob follows your cursor. The field is computed on a small grid and then
// stretched up smoothly, which keeps it fast.

interface Blob {
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  phase: number;
  r: number;
}

const EDGE = 0.9;
const SOLID = 1.05;
const blobs: Blob[] = [];
let grid: HTMLCanvasElement | null = null;
let image: ImageData | null = null;
let mx = 0;
let my = 0;

// Hue to RGB, worked out once.
const RAINBOW: [number, number, number][] = [];
for (let h = 0; h < 360; h++) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (0.55 - 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  RAINBOW.push([f(0), f(8), f(4)]);
}

export const lava: Effect<S> = {
  id: 'lava',
  name: 'Lava lamp',
  blurb: 'Glowing goo blobs drift, melt together, and follow you.',
  category: 'trippy',
  layer: 'back',
  settings: [
    { kind: 'range', key: 'blobs', label: 'Blobs', min: 3, max: 12, step: 1, default: 7 },
    { kind: 'range', key: 'size', label: 'Blob size', min: 40, max: 160, step: 10, default: 90 },
    { kind: 'range', key: 'speed', label: 'Color speed', min: 0, max: 10, step: 1, default: 4 },
  ],

  setup(env) {
    blobs.length = 0;
    mx = env.pointer.x;
    my = env.pointer.y;
  },

  update(dt, env, s) {
    const want = Math.round(s.blobs);
    while (blobs.length < want) {
      blobs.push({
        ax: 0.15 + Math.random() * 0.35,
        ay: 0.15 + Math.random() * 0.35,
        fx: 0.05 + Math.random() * 0.15,
        fy: 0.05 + Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
        r: 0.5 + Math.random() * 0.5,
      });
    }
    blobs.length = want;
    const ease = Math.min(1, dt * 4);
    mx += (env.pointer.x - mx) * ease;
    my += (env.pointer.y - my) * ease;
  },

  draw(env, s) {
    const cell = matchMedia('(pointer: coarse)').matches ? 10 : 6;
    const gw = Math.ceil(env.width / cell);
    const gh = Math.ceil(env.height / cell);
    grid ??= document.createElement('canvas');
    if (grid.width !== gw || grid.height !== gh) {
      grid.width = gw;
      grid.height = gh;
      image = null;
    }
    const g = grid.getContext('2d')!;
    image ??= g.createImageData(gw, gh);
    const data = image.data;

    // Blob centers and radii in grid cells.
    const t = env.time;
    const pts: number[] = [];
    for (const b of blobs) {
      const x = env.width * (0.5 + b.ax * Math.sin(t * b.fx * 2 + b.phase));
      const y = env.height * (0.5 + b.ay * Math.cos(t * b.fy * 2 + b.phase * 1.3));
      pts.push(x / cell, y / cell, ((s.size * b.r) / cell) ** 2);
    }
    if (env.pointer.inside) pts.push(mx / cell, my / cell, ((s.size * 0.9) / cell) ** 2);

    const shift = t * s.speed * 12;
    let i = 0;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++, i += 4) {
        let f = 0;
        for (let k = 0; k < pts.length; k += 3) {
          const dx = x - pts[k];
          const dy = y - pts[k + 1];
          f += pts[k + 2] / (dx * dx + dy * dy + 1);
        }
        if (f < EDGE) {
          data[i + 3] = 0;
          continue;
        }
        // Hue follows the depth of the goo (capped so centers stay smooth),
        // plus a slow drift over time and down the screen.
        const depth = Math.min(f, 4);
        const c = RAINBOW[Math.floor((depth * 45 + shift + y * 0.8) % 360)];
        data[i] = c[0];
        data[i + 1] = c[1];
        data[i + 2] = c[2];
        // A thin soft edge, then solid.
        data[i + 3] = f >= SOLID ? 210 : Math.round(((f - EDGE) / (SOLID - EDGE)) * 210);
      }
    }
    g.putImageData(image, 0, 0);

    const ctx = env.back;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(grid, 0, 0, gw * cell, gh * cell);
  },

  teardown() {
    blobs.length = 0;
  },
};
