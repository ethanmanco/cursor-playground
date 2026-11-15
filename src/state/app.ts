import type { Engine } from '../engine/engine';
import type { Effect, Values } from '../engine/types';
import { fullValues, type Setup } from './setup';

export interface EffectState {
  on: boolean;
  /** Read live by the engine, so it is mutated in place, never replaced. */
  values: Values;
}

/** 'structure' means effects turned on or off; 'value' means a slider moved. */
export type ChangeKind = 'structure' | 'value';

/** The single source of truth for which effects are on and their settings. */
export class App {
  readonly state = new Map<string, EffectState>();
  private listeners = new Set<(kind: ChangeKind) => void>();

  constructor(
    private engine: Engine,
    readonly effects: Effect[],
  ) {
    for (const fx of effects) this.state.set(fx.id, { on: false, values: fullValues(fx) });
  }

  get(fx: Effect): EffectState {
    return this.state.get(fx.id)!;
  }

  onCount(): number {
    return this.effects.filter((fx) => this.get(fx).on).length;
  }

  setOn(fx: Effect, on: boolean): void {
    const st = this.get(fx);
    if (st.on === on) return;
    st.on = on;
    if (on) this.engine.enable(fx, st.values);
    else this.engine.disable(fx);
    this.emit('structure');
  }

  setValue(fx: Effect, key: string, value: number | string): void {
    this.get(fx).values[key] = value;
    this.emit('value');
  }

  /** Replace the whole setup. With `enable: false`, values load but everything stays off. */
  apply(setup: Setup, { enable = true } = {}): void {
    for (const fx of this.effects) {
      const st = this.get(fx);
      if (st.on) {
        this.engine.disable(fx);
        st.on = false;
      }
      Object.assign(st.values, fullValues(fx, setup[fx.id] ?? {}));
    }
    if (enable) {
      for (const fx of this.effects) {
        if (!setup[fx.id]) continue;
        const st = this.get(fx);
        st.on = true;
        this.engine.enable(fx, st.values);
      }
    }
    this.emit('structure');
  }

  current(): Setup {
    const setup: Setup = {};
    for (const fx of this.effects) {
      const st = this.get(fx);
      if (st.on) setup[fx.id] = { ...st.values };
    }
    return setup;
  }

  onChange(fn: (kind: ChangeKind) => void): void {
    this.listeners.add(fn);
  }

  private emit(kind: ChangeKind): void {
    for (const fn of this.listeners) fn(kind);
  }
}
