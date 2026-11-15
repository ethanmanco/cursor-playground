import type { Effect, Env } from '../engine/types';

type S = { speed: number; boost: number };

// Slowly rolls every color on screen around the color wheel. It changes hue
// only, never brightness, so nothing flashes. Elements marked data-cp-trip
// (like the starry sky) join in too.
let targets: HTMLElement[] = [];
let hue = 0;

function collect(env: Env): HTMLElement[] {
  const set = new Set<HTMLElement>([env.front.canvas, env.back.canvas]);
  document.querySelectorAll<HTMLElement>('[data-cp-trip]').forEach((el) => set.add(el));
  return [...set];
}

export const trip: Effect<S> = {
  id: 'trip',
  name: 'Color trip',
  blurb: 'Slowly rolls every color on screen around the rainbow.',
  category: 'trippy',
  layer: 'back',
  settings: [
    { kind: 'range', key: 'speed', label: 'Speed', min: 1, max: 10, step: 1, default: 3 },
    { kind: 'range', key: 'boost', label: 'Color boost', min: 100, max: 300, step: 10, default: 170, unit: '%' },
  ],

  setup(env) {
    targets = collect(env);
    hue = 0;
  },

  update(dt, _env, s) {
    // At most about 150 degrees a second: a slow drift, not a strobe.
    hue = (hue + s.speed * 15 * dt) % 360;
  },

  draw(_env, s) {
    const filter = `hue-rotate(${hue.toFixed(1)}deg) saturate(${s.boost}%)`;
    for (const el of targets) el.style.filter = filter;
  },

  teardown() {
    for (const el of targets) el.style.filter = '';
    targets = [];
  },
};
