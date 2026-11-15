import type { Effect } from '../engine/types';
import { glowSprite, hexToHue } from './lib/color';
import { skyStars, skyState } from './lib/skypaint';

type S = { color: string; power: number; collapse: number };

// Supernova. Once it is switched on, double-click or double-tap anywhere.
//
// Collapse: every star in a big circle around that point falls toward it,
// including stars from beyond the edges of the screen, so the falling cloud
// is round and keeps streaming in from off-screen. Near stars arrive first.
// Burst: after a short hush, the swallowed stars are flung back out in an
// expanding ring and fly off the screen, and the blast shoves every other
// effect away. Then the normal sky fades gently back in.

interface FallingStar {
  hx: number; // where it started
  hy: number;
  x: number;
  y: number;
  px: number;
  py: number;
  r: number;
  alpha: number;
  tint: string;
  arrive: number; // seconds until it reaches the core
  onScreen: boolean; // part of the painted sky (fades back in at the end)
}

interface Debris {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  tint: string;
}

interface Spark {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

const HUSH = 0.2;
const SHELLS = 1.6;
const FADE_IN_START = 0.9; // seconds after the burst
const FADE_IN = 1.6;

let running = false;
let t = 0;
let cx = 0;
let cy = 0;
let boomed = false;
let pending: { x: number; y: number } | null = null;
let lastTap = { at: 0, x: 0, y: 0 };
let falling: FallingStar[] = [];
let debris: Debris[] = [];
let home: FallingStar[] = [];
const sparks: Spark[] = [];
let core: HTMLCanvasElement | null = null;

/** Set one off now (used by the N key). Only works while the effect is on. */
export function triggerSupernova(x: number, y: number): void {
  pending = { x, y };
}

const collapseTime = (s: S) => 0.7 + s.collapse * 0.15;
const TINTS = ['255,255,255', '200,220,255', '255,230,210', '190,255,250'];

/** The sky's stars, plus matching stars beyond the screen edges, inside a circle. */
function gather(w: number, h: number, x: number, y: number, C: number): FallingStar[] {
  const R = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y)) + 40;
  const out: FallingStar[] = [];
  const add = (sx: number, sy: number, r: number, alpha: number, tint: string, onScreen: boolean) => {
    const d = Math.hypot(sx - x, sy - y);
    if (d > R) return;
    out.push({
      hx: sx,
      hy: sy,
      x: sx,
      y: sy,
      px: sx,
      py: sy,
      r,
      alpha,
      tint,
      // Arrival depends only on distance, so the cloud stays round.
      arrive: C * (0.3 + 0.7 * Math.sqrt(d / R)) + Math.random() * 0.06,
      onScreen,
    });
  };
  for (const st of skyStars(w, h, skyState.stars)) add(st.x, st.y, st.r, st.alpha, st.tint, true);
  // Same density off-screen, so stars keep streaming in from the edges.
  const perArea = (skyState.stars / 6) / 2600;
  const box = (2 * R) ** 2;
  const tries = Math.round(box * perArea);
  for (let i = 0; i < tries; i++) {
    const sx = x - R + Math.random() * 2 * R;
    const sy = y - R + Math.random() * 2 * R;
    if (sx >= 0 && sx <= w && sy >= 0 && sy <= h) continue; // that area is the real sky
    const bright = Math.random();
    add(sx, sy, bright > 0.97 ? 1.4 : bright > 0.85 ? 1.0 : 0.6, 0.35 + bright * 0.6, TINTS[Math.floor(Math.random() * 4)], false);
  }
  return out;
}

export const supernova: Effect<S> = {
  id: 'supernova',
  name: 'Supernova',
  blurb: 'Double-click or double-tap: the stars fall in, then everything explodes.',
  category: 'click',
  layer: 'back',
  snippet: false,
  settings: [
    { kind: 'color', key: 'color', label: 'Blast color', default: '#9ec5ff' },
    { kind: 'range', key: 'power', label: 'Power', min: 1, max: 10, step: 1, default: 6 },
    { kind: 'range', key: 'collapse', label: 'Collapse time', min: 1, max: 10, step: 1, default: 5 },
  ],

  setup() {
    running = false;
    pending = null;
    skyState.wantStarless = true;
    core ??= glowSprite('#cfe8ff', 128);
  },

  onPointerDown(env) {
    // Real time, so double-clicks work the same in slow motion.
    const now = performance.now();
    const { x, y } = env.pointer;
    if (now - lastTap.at < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40) {
      pending = { x, y };
      lastTap = { at: 0, x: 0, y: 0 };
    } else {
      lastTap = { at: now, x, y };
    }
  },

  update(dt, env, s) {
    const C = collapseTime(s);
    if (pending && !running) {
      running = true;
      boomed = false;
      t = 0;
      cx = pending.x;
      cy = pending.y;
      falling = gather(env.width, env.height, cx, cy, C);
      home = falling.filter((f) => f.onScreen);
      debris = [];
      skyState.hideStars(true);
      env.cue('collapse', cx);
    }
    pending = null;
    if (!running) return;

    t += dt;
    const big = Math.hypot(env.width, env.height);
    const burstAt = C + HUSH;

    if (t < burstAt) {
      for (const st of falling) {
        st.px = st.x;
        st.py = st.y;
        const k = Math.min(1, t / st.arrive);
        const e = k * k * k; // slow at first, then faster and faster
        st.x = st.hx + (cx - st.hx) * e;
        st.y = st.hy + (cy - st.hy) * e;
      }
    }

    if (t < C) {
      const k = t / C;
      env.blast({ x: cx, y: cy, radius: big, strength: 500 + 5000 * k * k, kind: 'pull' });
    } else if (t > burstAt) {
      if (!boomed) {
        boomed = true;
        env.cue('boom', cx, s.power / 6);
        // Everything that fell in is flung back out, evenly in every direction.
        debris = falling.map((st) => {
          const a = Math.random() * Math.PI * 2;
          const v = (350 + Math.random() * 900) * (0.6 + s.power * 0.07);
          return { x: cx, y: cy, px: cx, py: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: st.r, alpha: st.alpha, tint: st.tint };
        });
        falling = [];
        const n = env.budget.take(60 + s.power * 25);
        const hue = hexToHue(s.color);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = (200 + Math.random() * 800) * (0.6 + s.power * 0.07);
          sparks.push({ x: cx, y: cy, px: cx, py: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8 + Math.random() * 1.2, hue: hue + (Math.random() - 0.5) * 120 });
        }
      }
      const p = Math.min(1, (t - burstAt) / SHELLS);
      if (p < 1) {
        env.blast({ x: cx, y: cy, radius: 80 + p * big, strength: 1500 * s.power * (1 - p), kind: 'push' });
        env.blast({ x: cx, y: cy, radius: 200 + p * big * 0.6, strength: 1 - p, kind: 'light' });
      }
    }

    // Debris flies straight out and off the screen.
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.px = d.x;
      d.py = d.y;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < -60 || d.x > env.width + 60 || d.y < -60 || d.y > env.height + 60) {
        debris[i] = debris[debris.length - 1];
        debris.pop();
      }
    }

    const drag = Math.pow(0.97, dt * 60);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        sparks[i] = sparks[sparks.length - 1];
        sparks.pop();
        env.budget.give(1);
        continue;
      }
      sp.px = sp.x;
      sp.py = sp.y;
      sp.vx *= drag;
      sp.vy *= drag;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
    }

    // Done once the sky has faded back in and the sparks have burned out.
    if (t > burstAt + FADE_IN_START + FADE_IN && sparks.length === 0 && debris.length === 0) {
      running = false;
      home = [];
      skyState.hideStars(false);
    }
  },

  draw(env, s) {
    if (!running) return;
    const C = collapseTime(s);
    const burstAt = C + HUSH;
    const back = env.back;
    back.lineCap = 'round';

    const star = (x: number, y: number, px: number, py: number, r: number, alpha: number, tint: string) => {
      const moved = Math.hypot(x - px, y - py);
      if (moved > 1.2) {
        // Fast stars stretch into streaks.
        back.strokeStyle = `rgba(${tint},${Math.min(1, alpha + 0.2)})`;
        back.lineWidth = r * 1.6;
        back.beginPath();
        back.moveTo(px - (x - px) * 1.5, py - (y - py) * 1.5);
        back.lineTo(x, y);
        back.stroke();
      } else {
        back.fillStyle = `rgba(${tint},${alpha})`;
        back.beginPath();
        back.arc(x, y, r, 0, Math.PI * 2);
        back.fill();
      }
    };

    for (const st of falling) {
      if (st.x < -20 || st.x > env.width + 20 || st.y < -20 || st.y > env.height + 20) continue;
      if (Math.hypot(st.x - cx, st.y - cy) < 6) continue; // swallowed
      star(st.x, st.y, st.px, st.py, st.r, st.alpha, st.tint);
    }
    for (const d of debris) star(d.x, d.y, d.px, d.py, d.r, d.alpha, d.tint);

    // The normal sky fades back in at the end.
    const fade = Math.min(1, Math.max(0, (t - burstAt - FADE_IN_START) / FADE_IN));
    if (fade > 0) {
      for (const h of home) {
        back.fillStyle = `rgba(${h.tint},${h.alpha * fade})`;
        back.beginPath();
        back.arc(h.hx, h.hy, h.r, 0, Math.PI * 2);
        back.fill();
      }
    }

    const ctx = env.front;
    const big = Math.hypot(env.width, env.height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (t < burstAt) {
      // The core grows brighter as it swallows stars.
      const k = Math.min(1, t / C);
      const r = 8 + k * k * 40 + Math.sin(t * 14) * k * 2;
      ctx.drawImage(core!, cx - r, cy - r, r * 2, r * 2);
    } else {
      const p = Math.min(1, (t - burstAt) / SHELLS);
      const hue = hexToHue(s.color);
      // One soft local flash at the start (not a strobe).
      if (p < 0.35) {
        const f = 1 - p / 0.35;
        const r = 60 + p * 700;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,255,255,${0.6 * f})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      if (p < 1) {
        for (let i = 0; i < 3; i++) {
          const r = p * big * 0.75 * (1 - i * 0.12);
          ctx.strokeStyle = `hsla(${hue + i * 45},100%,70%,${(1 - p) * 0.8})`;
          ctx.lineWidth = 2 + (1 - p) * 10;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
      for (const sp of sparks) {
        ctx.strokeStyle = `hsla(${sp.hue},100%,75%,${Math.min(1, sp.life)})`;
        ctx.beginPath();
        ctx.moveTo(sp.px - (sp.x - sp.px) * 2, sp.py - (sp.y - sp.py) * 2);
        ctx.lineTo(sp.x, sp.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  teardown(env) {
    env.budget.give(sparks.length);
    sparks.length = 0;
    falling = [];
    debris = [];
    home = [];
    running = false;
    skyState.hideStars(false);
    skyState.wantStarless = false;
  },
};
