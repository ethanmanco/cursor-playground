import type { Effect } from '../engine/types';
import { glowSprite, hexToHue } from './lib/color';
import { skyStars, skyState } from './lib/skypaint';

type S = { color: string; power: number; collapse: number };

// Supernova. Once it is switched on, double-click or double-tap anywhere:
// the real background stars come loose and fall toward that point, faster
// and faster, streaking as they go, while everything else is pulled in too.
// After a short hush it bursts. The stars are flung back out and settle into
// their old places, and the blast shoves every other effect away.

interface FallingStar {
  hx: number; // home
  hy: number;
  x: number;
  y: number;
  px: number;
  py: number;
  r: number;
  alpha: number;
  tint: string;
  delay: number; // seconds before it starts falling
  back: number; // seconds after the burst before it flies home
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
const RETURN = 1.3;
const SHELLS = 1.6;

let running = false;
let t = 0;
let cx = 0;
let cy = 0;
let boomed = false;
let pending: { x: number; y: number } | null = null;
let lastTap = { at: 0, x: 0, y: 0 };
let stars: FallingStar[] = [];
const sparks: Spark[] = [];
let core: HTMLCanvasElement | null = null;

/** Set one off now (used by the N key). Only works while the effect is on. */
export function triggerSupernova(x: number, y: number): void {
  pending = { x, y };
}

const collapseTime = (s: S) => 0.7 + s.collapse * 0.15;
const easeIn = (k: number) => k * k * k;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

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
    if (pending && !running) {
      running = true;
      boomed = false;
      t = 0;
      cx = pending.x;
      cy = pending.y;
      const far = Math.hypot(env.width, env.height);
      const C = collapseTime(s);
      stars = skyStars(env.width, env.height, skyState.stars).map((st) => {
        const d = Math.hypot(st.x - cx, st.y - cy);
        return {
          hx: st.x,
          hy: st.y,
          x: st.x,
          y: st.y,
          px: st.x,
          py: st.y,
          r: st.r,
          alpha: st.alpha,
          tint: st.tint,
          // Nearby stars let go first, the far ones a moment later.
          delay: (d / far) * C * 0.45 + Math.random() * 0.1,
          back: Math.random() * 0.25,
        };
      });
      skyState.hideStars(true);
      env.cue('collapse', cx);
    }
    pending = null;
    if (!running) return;

    t += dt;
    const C = collapseTime(s);
    const big = Math.hypot(env.width, env.height);
    const burstAt = C + HUSH;

    for (const st of stars) {
      st.px = st.x;
      st.py = st.y;
      if (t < burstAt) {
        const k = Math.min(1, Math.max(0, (t - st.delay) / (C - st.delay)));
        const e = easeIn(k);
        st.x = st.hx + (cx - st.hx) * e;
        st.y = st.hy + (cy - st.hy) * e;
      } else {
        const k = Math.min(1, Math.max(0, (t - burstAt - st.back) / RETURN));
        const e = easeOut(k);
        st.x = cx + (st.hx - cx) * e;
        st.y = cy + (st.hy - cy) * e;
      }
    }

    if (t < C) {
      const k = t / C;
      env.blast({ x: cx, y: cy, radius: big, strength: 500 + 5000 * k * k, kind: 'pull' });
    } else if (t > burstAt) {
      if (!boomed) {
        boomed = true;
        env.cue('boom', cx, s.power / 6);
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

    // Done once every star is home and the sparks have burned out.
    if (t > burstAt + RETURN + 0.3 && sparks.length === 0) {
      running = false;
      stars = [];
      skyState.hideStars(false);
    }
  },

  draw(env, s) {
    if (!running) return;
    const C = collapseTime(s);
    const burstAt = C + HUSH;

    // The moving stars live on the background layer, where the sky is.
    const back = env.back;
    back.lineCap = 'round';
    for (const st of stars) {
      const moved = Math.hypot(st.x - st.px, st.y - st.py);
      const swallowed = t < burstAt && Math.hypot(st.x - cx, st.y - cy) < 6;
      if (swallowed) continue;
      if (moved > 1.2) {
        // Fast stars stretch into streaks.
        back.strokeStyle = `rgba(${st.tint},${Math.min(1, st.alpha + 0.2)})`;
        back.lineWidth = st.r * 1.6;
        back.beginPath();
        back.moveTo(st.px - (st.x - st.px) * 1.5, st.py - (st.y - st.py) * 1.5);
        back.lineTo(st.x, st.y);
        back.stroke();
      } else {
        back.fillStyle = `rgba(${st.tint},${st.alpha})`;
        back.beginPath();
        back.arc(st.x, st.y, st.r, 0, Math.PI * 2);
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
    stars = [];
    running = false;
    skyState.hideStars(false);
    skyState.wantStarless = false;
  },
};
