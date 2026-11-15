import type { Effect } from '../engine/types';
import { cleanValue, type Setup } from './setup';

export interface Preset {
  name: string;
  setup: Setup;
}

export const PRESETS: Preset[] = [
  {
    name: 'Stardust',
    setup: {
      parallax: { depth: 6, drift: 3, density: 6 },
      constellation: { color: '#9ec5ff', count: 60, reach: 140 },
      trail: { color: '#6ee7ff', size: 14, amount: 6 },
    },
  },
  {
    name: 'Comet show',
    setup: {
      parallax: { depth: 8, drift: 5, density: 7 },
      comet: { color: '#ffd166', size: 20, tail: 45 },
      fireworks: { color: '#ffb347', sparks: 110, power: 6 },
    },
  },
  {
    name: 'Night painter',
    setup: {
      dotgrid: { color: '#7c9bff', spacing: 26, radius: 140 },
      paint: { size: 14, fade: 8, speed: 5 },
      fireworks: { color: '#ff7ad9', sparks: 70, power: 4 },
    },
  },
  {
    name: 'Who is watching?',
    setup: {
      eyes: { color: '#8affc1', count: 10, size: 44 },
      flashlight: { radius: 170, dark: 90, color: '#8affc1' },
      cursor: { shape: 'ufo', color: '#8affc1', size: 24 },
      trail: { color: '#8affc1', size: 8, amount: 3 },
    },
  },
  {
    name: 'Space snake',
    setup: {
      constellation: { color: '#b28cff', count: 50, reach: 160 },
      ribbon: { color: '#ff7ad9', length: 44, width: 18 },
      shockwave: { color: '#ff7ad9', size: 240, speed: 6 },
    },
  },
  {
    name: 'Warp speed',
    setup: {
      warp: { color: '#cfe3ff', speed: 5, count: 240 },
      boids: { color: '#6ee7ff', count: 45, speed: 6 },
      shockwave: { color: '#b28cff', size: 300, speed: 5 },
      cursor: { shape: 'rocket', color: '#ffd166', size: 24 },
    },
  },
  {
    name: 'Party time',
    setup: {
      gravity: { color: '#ff7ad9', pull: 5, count: 160 },
      confetti: { amount: 100, power: 6, size: 10 },
      fireworks: { color: '#ffd166', sparks: 80, power: 5 },
      cursor: { shape: 'star', color: '#ffd166', size: 22 },
    },
  },
  {
    name: 'Mind melt',
    setup: {
      chroma: { spread: 6, size: 22, trail: 5 },
      echo: { copies: 10, delay: 3, spin: 4 },
      trip: { speed: 3, boost: 170 },
    },
  },
  {
    name: 'Northern lights',
    setup: {
      aurora: { color: '#4dffb0', height: 55, speed: 3 },
      fireflies: { color: '#d8ff6b', count: 35, trust: 7 },
      cursor: { shape: 'orb', color: '#d8ff6b', size: 16 },
    },
  },
  {
    name: 'Bubble pop',
    setup: {
      ripples: { color: '#9ec5ff', size: 110, drops: 5 },
      bubbles: { size: 30, amount: 6, tint: 7 },
      orbit: { color: '#9ec5ff', moons: 3, speed: 4 },
    },
  },
  {
    name: 'Cosmic drift',
    setup: {
      sky: { theme: 'nebula', stars: 7, glow: 6 },
      smoke: { density: 4, swirl: 6, colors: 3 },
      meteors: { color: '#fff3cf', amount: 5, length: 6 },
      cursor: { shape: 'planet', color: '#ffd166', size: 26 },
    },
  },
  {
    name: 'Cursor party',
    setup: {
      conga: { color: '#ffd166', count: 10, spacing: 24 },
      echo: { copies: 8, delay: 3, spin: 0 },
      loop: { color: '#c9a7ff', length: 3, layers: 2 },
      rain: { amount: 16, size: 13, bounce: 6 },
    },
  },
  {
    name: 'Quiet pond',
    setup: {
      sky: { theme: 'ocean', stars: 5, glow: 6 },
      ripples: { color: '#9ec5ff', size: 120, drops: 5 },
      seeds: { count: 30, size: 11, wind: 3 },
      halo: { color: '#b9c8ff', size: 110, breath: 4 },
    },
  },
  {
    name: 'Magnet lab',
    setup: {
      sky: { theme: 'void', stars: 3, glow: 0 },
      magnet: { color: '#9ec5ff', spacing: 22, strength: 7 },
      gravity: { color: '#ff7ad9', pull: 4, count: 120 },
    },
  },
];

function randomColor(): string {
  // Bright, saturated colors that glow nicely on dark space.
  const h = Math.random() * 360;
  const s = 0.85 + Math.random() * 0.15;
  const l = 0.6 + Math.random() * 0.12;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Two to four random effects with random settings. Keeps at most one
 * drawing effect and one background so the mix stays readable.
 */
export function randomSetup(effects: Effect[]): Setup {
  const pool = [...effects].sort(() => Math.random() - 0.5);
  const want = 2 + Math.floor(Math.random() * 3);
  const setup: Setup = {};
  const used = new Set<string>();
  for (const fx of pool) {
    if (Object.keys(setup).length >= want) break;
    const limited = ['drawing', 'background', 'lighting', 'trippy', 'scene'].includes(fx.category);
    if (limited && used.has(fx.category)) continue;
    used.add(fx.category);
    const values: Record<string, number | string> = {};
    for (const def of fx.settings) {
      values[def.key] =
        def.kind === 'color'
          ? randomColor()
          : def.kind === 'choice'
            ? def.options[Math.floor(Math.random() * def.options.length)].value
            : cleanValue(def, def.min + Math.random() * (def.max - def.min));
    }
    setup[fx.id] = values;
  }
  return setup;
}
