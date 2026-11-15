import './style.css';
import { Engine } from './engine/engine';
import { defaultValues } from './engine/types';
import { EFFECTS } from './effects';
import { buildPanel, type EffectState } from './ui/panel';
import { paintSky } from './ui/sky';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Split the heading into letters so the repel effect can move them.
// Screen readers still read the whole phrase from aria-label.
const heading = $('heading');
const text = heading.textContent ?? '';
heading.setAttribute('aria-label', text);
heading.textContent = '';
for (const word of text.split(' ')) {
  const w = document.createElement('span');
  w.className = 'word';
  w.setAttribute('aria-hidden', 'true');
  for (const ch of word) {
    const c = document.createElement('span');
    c.className = 'char';
    c.textContent = ch;
    w.append(c);
  }
  heading.append(w, ' ');
}

paintSky($<HTMLCanvasElement>('sky'));

const engine = new Engine({
  stage: $('stage'),
  back: $<HTMLCanvasElement>('back'),
  front: $<HTMLCanvasElement>('front'),
  heading,
  registry: EFFECTS,
});

// Handy for poking at the engine from DevTools while developing.
if (import.meta.env.DEV) Object.assign(window, { __engine: engine });

// Starting setup. With reduced motion, everything stays off until chosen.
const STARTERS = reducedMotion ? [] : ['trail', 'fireworks'];
const state = new Map<string, EffectState>(
  EFFECTS.map((e) => [e.id, { on: STARTERS.includes(e.id), values: defaultValues(e) }]),
);

for (const fx of EFFECTS) {
  const st = state.get(fx.id)!;
  if (st.on) engine.enable(fx, st.values);
}

buildPanel({
  root: $('panel'),
  effects: EFFECTS,
  state,
  reducedMotion,
  onToggle(fx, on) {
    if (on) engine.enable(fx, state.get(fx.id)!.values);
    else engine.disable(fx);
  },
  onChange() {
    // Values are read live each frame, so nothing else to do yet.
  },
});
