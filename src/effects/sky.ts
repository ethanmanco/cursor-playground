import type { Effect } from '../engine/types';
import { paintSkyInto, SKY_THEMES, skyState } from './lib/skypaint';

type S = { theme: string; stars: number; glow: number };

// Swap the backdrop: pick a sky theme and tune its stars and nebula glow.
// The sky is painted once into a hidden canvas and copied each frame, so it
// costs almost nothing and other effects (like Color trip) still apply.

let cache: HTMLCanvasElement | null = null;
let starless: HTMLCanvasElement | null = null;
let cacheFor = '';

export const skyTheme: Effect<S> = {
  id: 'sky',
  name: 'Sky theme',
  blurb: 'Change the backdrop: deep space, nebula, ocean, sunset, or void.',
  category: 'scene',
  layer: 'back',
  snippet: false,
  settings: [
    {
      kind: 'choice',
      key: 'theme',
      label: 'Sky',
      options: [
        { value: 'nebula', label: 'Nebula' },
        { value: 'ocean', label: 'Ocean' },
        { value: 'sunset', label: 'Sunset' },
        { value: 'void', label: 'Void' },
        { value: 'space', label: 'Deep space' },
      ],
      default: 'nebula',
    },
    { kind: 'range', key: 'stars', label: 'Stars', min: 0, max: 10, step: 1, default: 6 },
    { kind: 'range', key: 'glow', label: 'Nebula glow', min: 0, max: 10, step: 1, default: 6 },
  ],

  setup() {
    cacheFor = '';
  },

  update() {},

  draw(env, s) {
    skyState.stars = s.stars;
    const key = `${s.theme}|${s.stars}|${s.glow}|${env.width}|${env.height}|${env.dpr}`;
    const paint = (stars: boolean) => {
      const c = document.createElement('canvas');
      c.width = Math.round(env.width * env.dpr);
      c.height = Math.round(env.height * env.dpr);
      const g = c.getContext('2d')!;
      g.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
      paintSkyInto(g, env.width, env.height, SKY_THEMES[s.theme] ?? SKY_THEMES.space, s.stars, s.glow, stars);
      return c;
    };
    if (key !== cacheFor) {
      cache = paint(true);
      starless = null;
      cacheFor = key;
    }
    // While a supernova moves the stars, show the sky without them.
    if (skyState.starsHidden || skyState.wantStarless) starless ??= paint(false);
    env.back.drawImage(skyState.starsHidden ? starless! : cache!, 0, 0, env.width, env.height);
  },

  teardown() {
    cacheFor = '';
    skyState.stars = 6;
  },
};
