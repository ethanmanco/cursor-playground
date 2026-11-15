import { describe, expect, it } from 'vitest';
import { EFFECTS } from '../effects';
import type { Effect } from '../engine/types';
import { PRESETS, randomSetup } from './presets';
import { cleanValue, decodeSetup, encodeSetup, fullValues } from './setup';

const byId = (id: string) => EFFECTS.find((e) => e.id === id)!;

describe('effect registry', () => {
  it('has the 17 effects with unique ids', () => {
    expect(EFFECTS).toHaveLength(17);
    expect(new Set(EFFECTS.map((e) => e.id)).size).toBe(17);
  });

  it('names every effect file after its id (Copy code relies on this)', () => {
    const files = import.meta.glob<Record<string, unknown>>('../effects/*.ts', { eager: true });
    for (const [path, mod] of Object.entries(files)) {
      if (path.endsWith('index.ts')) continue;
      const fx = Object.values(mod).find((v) => v && typeof v === 'object' && 'setup' in v) as Effect;
      expect(fx, path).toBeDefined();
      expect(path).toBe(`../effects/${fx.id}.ts`);
    }
  });

  it('gives every effect 2 or 3 settings with sane defaults', () => {
    for (const fx of EFFECTS) {
      expect(fx.settings.length, fx.id).toBeGreaterThanOrEqual(2);
      expect(fx.settings.length, fx.id).toBeLessThanOrEqual(3);
      for (const def of fx.settings) expect(cleanValue(def, def.default), `${fx.id}.${def.key}`).toBe(def.default);
    }
  });

  it('keeps ids free of the characters the link format uses', () => {
    for (const fx of EFFECTS) expect(fx.id).toMatch(/^[a-z0-9]+$/);
  });
});

describe('cleanValue', () => {
  const size = byId('trail').settings.find((s) => s.key === 'size')!; // 4..40 step 1
  const color = byId('trail').settings.find((s) => s.key === 'color')!;
  const fade = byId('paint').settings.find((s) => s.key === 'fade')!;

  it('clamps and snaps numbers', () => {
    expect(cleanValue(size, 999)).toBe(40);
    expect(cleanValue(size, -5)).toBe(4);
    expect(cleanValue(size, '12.6')).toBe(13);
    expect(cleanValue(fade, 3)).toBe(3);
  });

  it('falls back to the default for junk', () => {
    expect(cleanValue(size, 'abc')).toBe(14);
    expect(cleanValue(size, '')).toBe(14);
    expect(cleanValue(size, undefined)).toBe(14);
    expect(cleanValue(color, 'red')).toBe('#6ee7ff');
    expect(cleanValue(color, '<script>')).toBe('#6ee7ff');
  });

  it('normalizes colors', () => {
    expect(cleanValue(color, 'FF00AA')).toBe('#ff00aa');
    expect(cleanValue(color, '#ABCDEF')).toBe('#abcdef');
  });
});

describe('share links', () => {
  it('round-trips a setup', () => {
    const setup = {
      trail: { color: '#ff00aa', size: 20, amount: 3 },
      paint: { size: 8, fade: 10, speed: 2 },
    };
    const hash = encodeSetup(setup, EFFECTS);
    expect(hash).toBe('v1~paint_8_10_2~trail_ff00aa_20_3');
    expect(decodeSetup('#' + hash, EFFECTS)).toEqual(setup);
  });

  it('fills missing values with defaults', () => {
    expect(decodeSetup('#v1~trail', EFFECTS)).toEqual({ trail: fullValues(byId('trail')) });
    expect(decodeSetup('#v1~trail_00ff00', EFFECTS)).toEqual({ trail: { color: '#00ff00', size: 14, amount: 5 } });
  });

  it('ignores unknown effects, duplicates, and junk', () => {
    expect(decodeSetup('#v1~nope_1_2~trail_zzzzzz_9999_x~trail_000000', EFFECTS)).toEqual({
      trail: { color: '#6ee7ff', size: 40, amount: 5 },
    });
  });

  it('returns null for empty or foreign hashes', () => {
    expect(decodeSetup('', EFFECTS)).toBeNull();
    expect(decodeSetup('#', EFFECTS)).toBeNull();
    expect(decodeSetup('#section-2', EFFECTS)).toBeNull();
    expect(decodeSetup('#v9~trail', EFFECTS)).toBeNull();
  });

  it('treats a bare version as "everything off"', () => {
    expect(decodeSetup('#v1', EFFECTS)).toEqual({});
  });
});

describe('presets and randomize', () => {
  it('has 7 presets that only use real effects and survive a link round-trip', () => {
    expect(PRESETS).toHaveLength(7);
    for (const p of PRESETS) {
      for (const id of Object.keys(p.setup)) expect(byId(id), `${p.name}: ${id}`).toBeDefined();
      const full = Object.fromEntries(Object.entries(p.setup).map(([id, v]) => [id, fullValues(byId(id), v)]));
      expect(full, p.name).toEqual(Object.fromEntries(Object.entries(p.setup).map(([id, v]) => [id, { ...fullValues(byId(id)), ...v }])));
      expect(decodeSetup(encodeSetup(p.setup, EFFECTS), EFFECTS)).toEqual(full);
    }
  });

  it('randomizes 2 to 4 effects with valid values', () => {
    for (let i = 0; i < 200; i++) {
      const setup = randomSetup(EFFECTS);
      const ids = Object.keys(setup);
      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(ids.length).toBeLessThanOrEqual(4);
      const cats = ids.map((id) => byId(id).category);
      for (const c of ['drawing', 'background', 'lighting']) expect(cats.filter((x) => x === c).length).toBeLessThanOrEqual(1);
      for (const id of ids) expect(setup[id]).toEqual(fullValues(byId(id), setup[id]));
    }
  });
});
