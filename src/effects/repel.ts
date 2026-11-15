import type { Effect, Env } from '../engine/types';

type S = { radius: number; strength: number; bounce: number };

interface Letter {
  el: HTMLElement;
  /** Resting center in page coordinates, so scrolling does not break it. */
  cx: number;
  cy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

let letters: Letter[] = [];

function measure(env: Env) {
  const els = Array.from(env.heading.querySelectorAll<HTMLElement>('.char'));
  for (const el of els) el.style.transform = '';
  letters = els.map((el) => {
    const r = el.getBoundingClientRect();
    return {
      el,
      cx: r.left + r.width / 2 + scrollX,
      cy: r.top + r.height / 2 + scrollY,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    };
  });
}

export const repel: Effect<S> = {
  id: 'repel',
  name: 'Repel field',
  blurb: 'Brings back the title, then scatters its letters away from your cursor.',
  category: 'physics',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'radius', label: 'Reach', min: 60, max: 300, step: 10, default: 170 },
    { kind: 'range', key: 'strength', label: 'Push', min: 1, max: 10, step: 1, default: 6 },
    { kind: 'range', key: 'bounce', label: 'Bounce', min: 1, max: 10, step: 1, default: 5 },
  ],

  setup(env) {
    measure(env);
    // Fonts can change letter widths after load.
    document.fonts?.ready.then(() => {
      if (letters.length) measure(env);
    });
  },

  update(dt, env, s) {
    const p = env.pointer;
    const k = 30 + s.bounce * 10;
    const damping = 14 - s.bounce;
    const R = s.radius;
    for (const l of letters) {
      let fx = -l.x * k - l.vx * damping;
      let fy = -l.y * k - l.vy * damping;
      if (p.inside) {
        const dx = l.cx - scrollX + l.x - p.x;
        const dy = l.cy - scrollY + l.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < R) {
          const f = (1 - d / R) * s.strength * 700;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      l.vx += fx * dt;
      l.vy += fy * dt;
      l.x += l.vx * dt;
      l.y += l.vy * dt;
    }
  },

  draw() {
    for (const l of letters) {
      const still = Math.abs(l.x) < 0.05 && Math.abs(l.y) < 0.05;
      l.el.style.transform = still ? '' : `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) rotate(${(l.x * 0.2).toFixed(1)}deg)`;
    }
  },

  resize(env) {
    measure(env);
  },

  teardown() {
    for (const l of letters) l.el.style.transform = '';
    letters = [];
  },
};
