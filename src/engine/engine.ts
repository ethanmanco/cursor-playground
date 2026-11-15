import { createBudget, defaultCap } from './budget';
import { trackPointer, type PointerTracker } from './pointer';
import { trackTilt } from './tilt';
import type { Blast, Cue, Effect, Env, Values } from './types';

interface Active {
  effect: Effect;
  values: Values;
  order: number;
}

export interface EngineOptions {
  stage: HTMLElement;
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  /** Registry order decides draw order. */
  registry: Effect[];
}

/**
 * One shared animation loop for every effect. It sleeps when nothing is on
 * and pauses while the tab is hidden.
 */
export class Engine {
  readonly env: Env;
  private active: Active[] = [];
  private tracker: PointerTracker;
  private raf = 0;
  private last = 0;
  private order: Map<string, number>;
  private nextBlasts: Blast[] = [];
  private scaleTarget = 1;
  /** Called for every sound cue; the app plugs its sound player in here. */
  onCue: ((name: Cue, x: number, strength: number) => void) | null = null;
  private tiltTick: (dt: number) => void;

  constructor(private opts: EngineOptions) {
    const front = opts.front.getContext('2d');
    const back = opts.back.getContext('2d');
    if (!front || !back) throw new Error('Canvas 2D is not available');
    this.order = new Map(opts.registry.map((e, i) => [e.id, i]));
    this.tracker = trackPointer(opts.stage, () => this.pointerDown());
    this.env = {
      front,
      back,
      width: 0,
      height: 0,
      dpr: 1,
      pointer: this.tracker.pointer,
      time: 0,
      budget: createBudget(defaultCap()),
      tilt: { x: 0, y: 0, active: false },
      timeScale: 1,
      blasts: [],
      blast: (b) => {
        if (this.nextBlasts.length < 64) this.nextBlasts.push(b);
      },
      cue: (name, x, strength) => this.onCue?.(name, x ?? this.env.width / 2, strength ?? 1),
      ghostClick: (x, y, from) => {
        const p = this.env.pointer;
        const saved = { x: p.x, y: p.y, inside: p.inside };
        p.x = x;
        p.y = y;
        p.inside = true;
        for (const a of this.active) if (a.effect.id !== from) a.effect.onPointerDown?.(this.env, a.values);
        Object.assign(p, saved);
      },
    };
    this.tiltTick = trackTilt(this.env.tilt);
    this.resize();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else this.wake();
    });
  }

  /** Ease toward a new speed: 1 normal, 0.2 slow motion, 0 frozen. */
  setTimeScale(target: number): void {
    this.scaleTarget = target;
  }

  get timeScaleTarget(): number {
    return this.scaleTarget;
  }

  isOn(id: string): boolean {
    return this.active.some((a) => a.effect.id === id);
  }

  /** Turn an effect on. `values` is read live, so mutate it to change settings. */
  enable(effect: Effect, values: Values): void {
    if (this.isOn(effect.id)) return;
    effect.setup(this.env, values);
    this.active.push({ effect, values, order: this.order.get(effect.id) ?? 999 });
    this.active.sort((a, b) => a.order - b.order);
    this.wake();
  }

  disable(effect: Effect): void {
    const i = this.active.findIndex((a) => a.effect.id === effect.id);
    if (i < 0) return;
    this.active[i].effect.teardown(this.env);
    this.active.splice(i, 1);
    if (this.active.length === 0) {
      this.clear();
      this.stop();
    }
  }

  private pointerDown(): void {
    for (const a of this.active) a.effect.onPointerDown?.(this.env, a.values);
  }

  private resize(): void {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = innerWidth;
    const h = innerHeight;
    for (const c of [this.opts.front, this.opts.back]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    Object.assign(this.env, { width: w, height: h, dpr });
    for (const a of this.active) a.effect.resize?.(this.env);
  }

  private clear(): void {
    const { front, back, dpr, width, height } = this.env;
    for (const ctx of [front, back]) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
    }
  }

  private wake(): void {
    if (this.raf || document.hidden || this.active.length === 0) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame = (now: number): void => {
    const real = Math.min(Math.max((now - this.last) / 1000, 0), 0.05);
    this.last = now;
    // Ease the speed so slow motion glides in and out.
    const env = this.env;
    env.timeScale += (this.scaleTarget - env.timeScale) * Math.min(1, real * 8);
    if (Math.abs(env.timeScale - this.scaleTarget) < 0.01) env.timeScale = this.scaleTarget;
    const dt = real * env.timeScale;
    env.time += dt;
    this.tracker.beginFrame(real);
    this.tiltTick(real);

    // Last frame's blasts become readable; this frame's start fresh.
    env.blasts = this.nextBlasts;
    this.nextBlasts = [];

    for (const a of this.active) a.effect.update(dt, env, a.values);

    // One-off effects (like a supernova) can switch themselves off.
    for (const a of this.active.filter((a) => a.effect.finished?.())) this.disable(a.effect);
    if (!this.active.length) return;

    this.clear();
    for (const a of this.active) {
      const ctx = a.effect.layer === 'back' ? this.env.back : this.env.front;
      ctx.save();
      a.effect.draw(this.env, a.values);
      ctx.restore();
    }

    this.tracker.endFrame();
    this.raf = this.active.length ? requestAnimationFrame(this.frame) : 0;
  };
}
