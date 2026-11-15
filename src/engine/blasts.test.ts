import { describe, expect, it } from 'vitest';
import { blastAt } from './blasts';
import type { Blast } from './types';

describe('blastAt', () => {
  it('pushes away from the center, strongest close in', () => {
    const blasts: Blast[] = [{ x: 0, y: 0, radius: 100, strength: 1000, kind: 'push' }];
    const near = { ...blastAt(blasts, 10, 0) };
    const far = { ...blastAt(blasts, 90, 0) };
    expect(near.fx).toBeGreaterThan(far.fx);
    expect(far.fx).toBeGreaterThan(0);
    expect(near.push).toBeCloseTo(900);
  });

  it('pulls toward the center', () => {
    const r = blastAt([{ x: 0, y: 0, radius: 100, strength: 500, kind: 'pull' }], 50, 0);
    expect(r.fx).toBeLessThan(0);
    expect(r.push).toBe(0);
  });

  it('does nothing outside the radius', () => {
    const r = blastAt([{ x: 0, y: 0, radius: 100, strength: 500, kind: 'push' }], 150, 0);
    expect(r.fx).toBe(0);
    expect(r.fy).toBe(0);
  });

  it('rings only affect a band around their edge', () => {
    const ring: Blast[] = [{ x: 0, y: 0, radius: 200, strength: 1000, kind: 'push', ring: true }];
    expect(blastAt(ring, 50, 0).fx).toBe(0);
    expect(blastAt(ring, 200, 0).fx).toBeCloseTo(1000);
  });

  it('light reports brightness without moving anything', () => {
    const r = blastAt([{ x: 0, y: 0, radius: 100, strength: 0.8, kind: 'light' }], 0, 50);
    expect(r.light).toBeCloseTo(0.4);
    expect(r.fx).toBe(0);
    expect(r.fy).toBe(0);
  });
});
