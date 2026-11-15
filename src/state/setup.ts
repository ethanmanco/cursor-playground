import type { Effect, SettingDef, Values } from '../engine/types';

/** The effects that are on, with their values. Effects not listed are off. */
export type Setup = Record<string, Partial<Values>>;

const VERSION = 'v1';

function decimals(step: number): number {
  const s = String(step);
  return s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
}

/** Force any value into a safe one for this setting (range, step, or hex color). */
export function cleanValue(def: SettingDef, raw: unknown): number | string {
  if (def.kind === 'color') {
    const s = String(raw ?? '').trim().replace(/^#/, '');
    return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toLowerCase()}` : def.default;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (raw === '' || raw == null || !Number.isFinite(n)) return def.default;
  const clamped = Math.min(def.max, Math.max(def.min, n));
  const snapped = def.min + Math.round((clamped - def.min) / def.step) * def.step;
  return Number(Math.min(def.max, snapped).toFixed(decimals(def.step)));
}

/** Defaults merged with whatever partial values are given, all cleaned. */
export function fullValues(effect: Effect, partial: Partial<Values> = {}): Values {
  const v: Values = {};
  for (const def of effect.settings) v[def.key] = cleanValue(def, partial[def.key] ?? def.default);
  return v;
}

/**
 * Share-link format: `#v1~trail_6ee7ff_14_5~paint_12_5_4`
 * Each item is an effect id, then its setting values in the order the effect
 * lists them. Missing values fall back to defaults, so settings can be added
 * to the end of an effect later without breaking old links.
 */
export function encodeSetup(setup: Setup, effects: Effect[]): string {
  const items = [VERSION];
  for (const fx of effects) {
    const partial = setup[fx.id];
    if (!partial) continue;
    const v = fullValues(fx, partial);
    const parts = fx.settings.map((def) => (def.kind === 'color' ? String(v[def.key]).slice(1) : String(v[def.key])));
    items.push([fx.id, ...parts].join('_'));
  }
  return items.join('~');
}

/** Returns null when the hash is empty or not a setup link. */
export function decodeSetup(hash: string, effects: Effect[]): Setup | null {
  const raw = decodeURIComponent(hash.replace(/^#/, '')).trim();
  if (!raw) return null;
  const [version, ...items] = raw.split('~');
  if (version !== VERSION) return null;
  const byId = new Map(effects.map((e) => [e.id, e]));
  const setup: Setup = {};
  for (const item of items) {
    const [id, ...parts] = item.split('_');
    const fx = byId.get(id);
    if (!fx || setup[id]) continue;
    const partial: Partial<Values> = {};
    fx.settings.forEach((def, i) => {
      if (parts[i] !== undefined && parts[i] !== '') partial[def.key] = parts[i];
    });
    setup[id] = fullValues(fx, partial);
  }
  return setup;
}
