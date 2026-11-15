import './style.css';
import { Engine } from './engine/engine';
import { splitHeading } from './engine/split';
import { EFFECTS } from './effects';
import { App } from './state/app';
import { decodeSetup, encodeSetup, type Setup } from './state/setup';
import { buildPanel } from './ui/panel';
import { paintSky } from './ui/sky';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// `?reduce` fakes the reduced-motion setting while developing.
const reducedMotion =
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  (import.meta.env.DEV && new URLSearchParams(location.search).has('reduce'));

const heading = $('heading');
splitHeading(heading);
paintSky($<HTMLCanvasElement>('sky'));

const engine = new Engine({
  stage: $('stage'),
  back: $<HTMLCanvasElement>('back'),
  front: $<HTMLCanvasElement>('front'),
  heading,
  registry: EFFECTS,
});
const app = new App(engine, EFFECTS);

// Handy for poking at things from DevTools while developing.
if (import.meta.env.DEV) Object.assign(window, { __engine: engine, __app: app });

const STARTER: Setup = { trail: {}, fireworks: {} };

const shareHash = () => '#' + encodeSetup(app.current(), EFFECTS);
const shareLink = () => location.origin + location.pathname + shareHash();

const panel = buildPanel({ root: $('panel'), app, reducedMotion, shareLink });

/**
 * Load a setup. People who prefer reduced motion get the values loaded but
 * nothing moving, plus a button to turn the shared effects on.
 */
let pending: Setup | null = null;
let loading = false;

function load(setup: Setup) {
  loading = true;
  pending = reducedMotion && Object.keys(setup).length ? setup : null;
  app.apply(setup, { enable: !pending });
  panel.showPending(pending);
  loading = false;
}

load(decodeSetup(location.hash, EFFECTS) ?? (reducedMotion ? {} : STARTER));

// Keep the address bar in sync so copying it from the browser works too.
// While a shared setup waits to be turned on, the link stays as it was.
let urlTimer = 0;
app.onChange((kind) => {
  if (loading) return;
  if (kind === 'structure' && pending) {
    pending = null;
    panel.showPending(null);
  }
  if (pending) return;
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => history.replaceState(null, '', shareHash()), 250);
});

// A share link pasted into this same tab only changes the hash.
addEventListener('hashchange', () => {
  const setup = decodeSetup(location.hash, EFFECTS);
  if (setup) load(setup);
});
