// The shared contract every effect follows. Add an effect by writing one file
// that exports an `Effect` and listing it in src/effects/index.ts.

export type Category = 'cursor' | 'followers' | 'drawing' | 'trippy' | 'background' | 'lighting' | 'physics' | 'click';

export const CATEGORY_LABELS: Record<Category, string> = {
  cursor: 'Your cursor',
  followers: 'Followers',
  drawing: 'Drawing',
  trippy: 'Psychedelic',
  background: 'Background',
  lighting: 'Lighting',
  physics: 'Physics',
  click: 'Click',
};

export const CATEGORY_ORDER: Category[] = ['cursor', 'followers', 'drawing', 'trippy', 'background', 'lighting', 'physics', 'click'];

export interface RangeSetting {
  kind: 'range';
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface ColorSetting {
  kind: 'color';
  key: string;
  label: string;
  /** Hex color, `#rrggbb`. */
  default: string;
}

export interface ChoiceSetting {
  kind: 'choice';
  key: string;
  label: string;
  /** Values must be short lowercase letters and digits, since they go in share links. */
  options: { value: string; label: string }[];
  default: string;
}

export type SettingDef = RangeSetting | ColorSetting | ChoiceSetting;

export type Values = Record<string, number | string>;

export interface Pointer {
  /** Current position in CSS pixels. */
  x: number;
  y: number;
  /** Position at the start of the previous frame. Equal to x/y after a jump. */
  px: number;
  py: number;
  /** Velocity in CSS pixels per second. */
  vx: number;
  vy: number;
  down: boolean;
  /** True while a mouse is over the stage, or a finger/pen is touching it. */
  inside: boolean;
  type: 'mouse' | 'touch' | 'pen';
}

export interface Budget {
  /** Ask for up to n particles. Returns how many you may create. */
  take(n: number): number;
  /** Return n particles when they die or the effect turns off. */
  give(n: number): void;
  readonly cap: number;
  readonly used: number;
}

export interface Env {
  front: CanvasRenderingContext2D;
  back: CanvasRenderingContext2D;
  /** Viewport size in CSS pixels. Contexts are already scaled for the device pixel ratio. */
  width: number;
  height: number;
  dpr: number;
  pointer: Pointer;
  /** Seconds since the engine started. */
  time: number;
  budget: Budget;
}

export interface Effect<S extends Values = Values> {
  /** Short and stable. Used in share links, so never rename it. */
  id: string;
  name: string;
  /** One short sentence shown under the name in the panel. */
  blurb: string;
  category: Category;
  layer: 'back' | 'front';
  /** Two or three controls. */
  settings: SettingDef[];
  setup(env: Env, s: S): void;
  /** dt is in seconds and capped at 0.05. */
  update(dt: number, env: Env, s: S): void;
  draw(env: Env, s: S): void;
  onPointerDown?(env: Env, s: S): void;
  resize?(env: Env): void;
  /** Give back budget and undo any DOM changes. */
  teardown(env: Env): void;
}

export function defaultValues(effect: Effect): Values {
  const v: Values = {};
  for (const s of effect.settings) v[s.key] = s.default;
  return v;
}
