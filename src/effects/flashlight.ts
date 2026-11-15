import type { Effect, Env } from '../engine/types';
import { rgba } from './lib/color';

type S = { radius: number; dark: number; color: string };

// The screen goes dark except for a soft beam around the cursor. Inside the
// beam, a hidden star map with secret messages shows through.
let hidden: HTMLCanvasElement | null = null;
let hiddenFor = '';
let beam: HTMLCanvasElement | null = null;
let lx = 0;
let ly = 0;

const MESSAGES = [
  'hello, explorer',
  'you found a secret',
  'keep looking',
  'the stars are watching',
  'is anybody out there?',
  'nothing to see here',
];

function paintHidden(env: Env, color: string): HTMLCanvasElement {
  const c = hidden ?? document.createElement('canvas');
  const { width: W, height: H, dpr } = env;
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  let seed = 5;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const step = 230;
  let m = 0;
  for (let y = step / 2, row = 0; y < H + step; y += step * 0.8, row++) {
    for (let x = (row % 2 ? step / 2 : 0) + step / 4; x < W + step; x += step) {
      if (rand() < 0.35) {
        g.font = '600 20px "Space Grotesk", system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = color;
        g.fillText(MESSAGES[m++ % MESSAGES.length], x, y + 6);
        continue;
      }
      // A tiny solar system: a sun, orbits, and planets.
      g.strokeStyle = rgba(color, 0.55);
      g.lineWidth = 1.2;
      for (const r of [26, 48, 72]) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.stroke();
        const a = rand() * Math.PI * 2;
        g.fillStyle = color;
        g.beginPath();
        g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 3 + rand() * 4, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

export const flashlight: Effect<S> = {
  id: 'flashlight',
  name: 'Flashlight',
  blurb: 'Lights out. Shine a beam to find a hidden star map.',
  category: 'lighting',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'radius', label: 'Beam size', min: 60, max: 300, step: 10, default: 160 },
    { kind: 'range', key: 'dark', label: 'Darkness', min: 30, max: 100, step: 5, default: 90, unit: '%' },
    { kind: 'color', key: 'color', label: 'Secret color', default: '#8affc1' },
  ],

  setup(env) {
    lx = env.pointer.x;
    ly = env.pointer.y;
    hiddenFor = '';
    // Repaint once the web font is ready so the messages use it.
    document.fonts?.ready.then(() => (hiddenFor = ''));
  },

  update(dt, env, s) {
    const ease = Math.min(1, dt * 14);
    lx += (env.pointer.x - lx) * ease;
    ly += (env.pointer.y - ly) * ease;
    const key = `${s.color}|${env.width}|${env.height}|${env.dpr}`;
    if (key !== hiddenFor) {
      hidden = paintHidden(env, s.color);
      hiddenFor = key;
    }
  },

  draw(env, s) {
    const ctx = env.front;
    const R = s.radius;
    const shade = `rgba(3,4,12,${s.dark / 100})`;

    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.rect(0, 0, env.width, env.height);
    ctx.arc(lx, ly, R, 0, Math.PI * 2);
    ctx.fill('evenodd');

    const edge = ctx.createRadialGradient(lx, ly, R * 0.5, lx, ly, R);
    edge.addColorStop(0, 'rgba(3,4,12,0)');
    edge.addColorStop(1, shade);
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.arc(lx, ly, R, 0, Math.PI * 2);
    ctx.fill();

    if (!hidden) return;
    const size = Math.ceil(R * 2 * env.dpr);
    beam ??= document.createElement('canvas');
    if (beam.width !== size) beam.width = beam.height = size;
    const b = beam.getContext('2d')!;
    b.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, R * 2, R * 2);
    b.drawImage(hidden, -(lx - R), -(ly - R), env.width, env.height);
    b.globalCompositeOperation = 'destination-in';
    const mask = b.createRadialGradient(R, R, 0, R, R, R);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.55, 'rgba(0,0,0,0.9)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = mask;
    b.fillRect(0, 0, R * 2, R * 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(beam, lx - R, ly - R, R * 2, R * 2);
  },

  resize() {
    hiddenFor = '';
  },

  teardown() {
    hidden = null;
    hiddenFor = '';
  },
};
