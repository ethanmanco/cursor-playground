import type { Blast } from './types';

/**
 * How effects nudge each other. An effect that makes a bang (a shockwave, a
 * firework, a supernova) adds a Blast; other effects ask how a blast affects
 * each of their particles. Blasts added this frame are read next frame, so
 * draw order does not matter.
 */

export interface BlastResult {
  /** Acceleration to add, in px/s^2. */
  fx: number;
  fy: number;
  /** 0..1, how brightly something here is lit up. */
  light: number;
  /** Strongest push here (px/s^2). Fragile things, like bubbles, can pop. */
  push: number;
}

const RING_BAND = 40;
const out: BlastResult = { fx: 0, fy: 0, light: 0, push: 0 };

/** The combined effect of all blasts at (x, y). Reuses one object, so read it right away. */
export function blastAt(blasts: readonly Blast[], x: number, y: number): BlastResult {
  out.fx = out.fy = out.light = out.push = 0;
  for (const b of blasts) {
    const dx = x - b.x;
    const dy = y - b.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    let w: number;
    if (b.ring) {
      const gap = Math.abs(d - b.radius);
      if (gap > RING_BAND) continue;
      w = 1 - gap / RING_BAND;
    } else {
      if (d > b.radius) continue;
      w = 1 - d / b.radius;
    }
    if (b.kind === 'light') {
      out.light = Math.max(out.light, w * Math.min(1, b.strength));
      continue;
    }
    const f = w * b.strength * (b.kind === 'pull' ? -1 : 1);
    out.fx += (dx / d) * f;
    out.fy += (dy / d) * f;
    if (b.kind === 'push') out.push = Math.max(out.push, w * b.strength);
  }
  return out;
}
