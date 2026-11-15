import type { Effect } from '../engine/types';
import { arrowPath } from './lib/arrow';
import { rgba } from './lib/color';

type S = { color: string; length: number; layers: number };

// Time loop: a ghost of you replays everything you did a few seconds ago,
// clicks included. Click to set off a firework, and a few seconds later your
// ghost sets off the same firework again. With more layers, older ghosts
// replay even further back, so a single click can echo several times.

interface Sample {
  t: number;
  x: number;
  y: number;
  inside: boolean;
  click: boolean;
}

const tape: Sample[] = [];
let clicked = false;
const lastSeen: number[] = []; // per layer: the tape time it last replayed up to

/** Index of the last sample at or before time `at` (binary search). */
function find(at: number): number {
  let lo = 0;
  let hi = tape.length - 1;
  if (hi < 0 || tape[0].t > at) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tape[mid].t <= at) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export const timeLoop: Effect<S> = {
  id: 'loop',
  name: 'Time loop',
  blurb: 'A ghost of you replays your moves and clicks a few seconds later.',
  category: 'trippy',
  layer: 'front',
  settings: [
    { kind: 'color', key: 'color', label: 'Ghost color', default: '#c9a7ff' },
    { kind: 'range', key: 'length', label: 'Delay', min: 2, max: 8, step: 1, default: 4, unit: 's' },
    { kind: 'range', key: 'layers', label: 'Ghosts', min: 1, max: 3, step: 1, default: 1 },
  ],

  setup() {
    tape.length = 0;
    lastSeen.length = 0;
  },

  onPointerDown() {
    clicked = true;
  },

  update(_dt, env, s) {
    const p = env.pointer;
    tape.push({ t: env.time, x: p.x, y: p.y, inside: p.inside, click: clicked });
    clicked = false;
    const keep = s.length * s.layers + 0.5;
    let cut = 0;
    while (cut < tape.length && env.time - tape[cut].t > keep) cut++;
    if (cut) tape.splice(0, cut);

    // Replay any clicks each ghost passed over since last frame.
    for (let k = 1; k <= s.layers; k++) {
      const at = env.time - k * s.length;
      const from = lastSeen[k] ?? at;
      if (at > from) {
        for (let i = Math.max(0, find(from) + 1); i < tape.length && tape[i].t <= at; i++) {
          if (tape[i].click) env.ghostClick(tape[i].x, tape[i].y, 'loop');
        }
      }
      lastSeen[k] = at;
    }
  },

  draw(env, s) {
    const ctx = env.front;
    ctx.lineJoin = 'round';
    for (let k = 1; k <= s.layers; k++) {
      const at = env.time - k * s.length;
      const i = find(at);
      if (i < 0 || !tape[i].inside) continue;
      const fade = 1 - (k - 1) * 0.3;
      // A short trail behind the ghost.
      ctx.strokeStyle = rgba(s.color, 0.35 * fade);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const j0 = find(at - 0.35);
      ctx.moveTo(tape[Math.max(0, j0)].x, tape[Math.max(0, j0)].y);
      for (let j = Math.max(0, j0); j <= i; j++) if (tape[j].inside) ctx.lineTo(tape[j].x, tape[j].y);
      ctx.stroke();
      ctx.globalAlpha = 0.75 * fade;
      ctx.fillStyle = s.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.2;
      arrowPath(ctx, tape[i].x, tape[i].y, 20);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  teardown() {
    tape.length = 0;
    lastSeen.length = 0;
  },
};
