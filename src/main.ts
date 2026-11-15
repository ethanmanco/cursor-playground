import './style.css';
import { Engine } from './engine/engine';
import { EFFECTS } from './effects';
import { App } from './state/app';
import { decodeSetup, encodeSetup, type Setup } from './state/setup';
import { buildPanel } from './ui/panel';
import { startAutopilot } from './ui/autopilot';
import { paintSky } from './ui/sky';
import { savePicture } from './ui/snapshot';
import { tiltSteer } from './ui/tiltsteer';
import { createSound } from './ui/sound';
import { triggerSupernova } from './effects/supernova';
import { recalibrate, requestTilt } from './engine/tilt';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// `?reduce` fakes the reduced-motion setting while developing.
const reducedMotion =
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  (import.meta.env.DEV && new URLSearchParams(location.search).has('reduce'));

paintSky($<HTMLCanvasElement>('sky'));

const engine = new Engine({
  stage: $('stage'),
  back: $<HTMLCanvasElement>('back'),
  front: $<HTMLCanvasElement>('front'),
  registry: EFFECTS,
});
const app = new App(engine, EFFECTS);

// Handy for poking at things from DevTools while developing.
if (import.meta.env.DEV) Object.assign(window, { __engine: engine, __app: app });

const STARTER: Setup = { trail: {}, fireworks: {} };

const shareHash = () => '#' + encodeSetup(app.current(), EFFECTS);
const shareLink = () => location.origin + location.pathname + shareHash();

// Autopilot is a per-browser preference, so it lives in localStorage.
const PILOT_KEY = 'cursor-playground:autopilot';
const pilotPref = {
  get(): boolean {
    try {
      const v = localStorage.getItem(PILOT_KEY);
      return v === null ? !reducedMotion : v === '1';
    } catch {
      return !reducedMotion;
    }
  },
  set(on: boolean) {
    try {
      localStorage.setItem(PILOT_KEY, on ? '1' : '0');
    } catch {
      // Storage blocked: the switch still works for this visit.
    }
    pilotOn = on;
  },
};
let pilotOn = pilotPref.get();

// Optional sound, off unless this browser turned it on before. Browsers only
// allow audio after a click or key press, so a saved "on" waits for one.
const SOUND_KEY = 'cursor-playground:sound';
const sound = createSound();
engine.onCue = (name, x, strength) => sound.play(name, x, strength, engine.env.timeScale);
if (import.meta.env.DEV) Object.assign(window, { __sound: sound });
let soundWanted = false;
try {
  soundWanted = localStorage.getItem(SOUND_KEY) === '1';
} catch {
  // Storage blocked: sound starts off.
}
if (soundWanted) {
  const wake = () => {
    sound.setOn(true);
    removeEventListener('pointerdown', wake, true);
    removeEventListener('keydown', wake, true);
  };
  addEventListener('pointerdown', wake, true);
  addEventListener('keydown', wake, true);
}
const soundPref = {
  get: () => soundWanted,
  set(on: boolean) {
    soundWanted = on;
    sound.setOn(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? '1' : '0');
    } catch {
      // Fine: it still works for this visit.
    }
  },
};

// Tilt to steer is offered on touch devices that report motion.
const canTilt = 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches;
const steer = canTilt ? tiltSteer($('stage'), engine.env.tilt) : null;
let tiltOn = false;

const panel = buildPanel({
  root: $('panel'),
  app,
  reducedMotion,
  shareLink,
  savePicture: () => savePicture([$<HTMLCanvasElement>('sky'), $<HTMLCanvasElement>('back'), $<HTMLCanvasElement>('front')]),
  autopilot: pilotPref,
  tilt: steer
    ? async (on) => {
        if (on && !(await requestTilt())) {
          // Some browsers answer "denied" but send motion data anyway.
          await new Promise((r) => setTimeout(r, 400));
          if (!engine.env.tilt.active) return false;
        }
        recalibrate();
        tiltOn = on;
        steer.set(on);
        return true;
      }
    : undefined,
  setTimeScale: (scale) => engine.setTimeScale(scale),
  sound: soundPref,
  supernova() {
    if (!engine.isOn('supernova')) return false;
    const p = engine.env.pointer;
    triggerSupernova(p.inside ? p.x : innerWidth / 2, p.inside ? p.y : innerHeight / 2);
    return true;
  },
  onTour(on) {
    touring = on;
    if (on) pilot.kick();
  },
});

let touring = false;
const pilot = startAutopilot({ stage: $('stage'), allowed: () => (pilotOn || touring) && !tiltOn && app.onCount() > 0 });

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

// The title greets people, then fades so it stays out of the way.
const TITLE_SECONDS = 3;
window.setTimeout(() => document.querySelector('.hero')?.classList.add('is-faded'), TITLE_SECONDS * 1000);

// A share link pasted into this same tab only changes the hash.
addEventListener('hashchange', () => {
  const setup = decodeSetup(location.hash, EFFECTS);
  if (setup) load(setup);
});
