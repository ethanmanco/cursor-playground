import { createBudget, defaultCap } from './budget';
import { trackPointer, type PointerTracker } from './pointer';
import type { Effect, Env, Values } from './types';

interface Active {
  effect: Effect;
  values: Values;
  order: number;
}

export interface EngineOptions {
  stage: HTMLElement;
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  heading: HTMLElement;
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
  private start = performance.now();
  private order: Map<string, number>;

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
      heading: opts.heading,
    };
    this.resize();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else this.wake();
    });
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
    const dt = Math.min(Math.max((now - this.last) / 1000, 0), 0.05);
    this.last = now;
    this.env.time = (now - this.start) / 1000;
    this.tracker.beginFrame(dt);

    for (const a of this.active) a.effect.update(dt, this.env, a.values);

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
