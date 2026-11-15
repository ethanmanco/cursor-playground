import type { Budget } from './types';

/** One shared particle pool so stacked effects cannot overload a phone. */
export function createBudget(cap: number): Budget {
  let used = 0;
  return {
    cap,
    get used() {
      return used;
    },
    take(n) {
      const granted = Math.max(0, Math.min(Math.floor(n), cap - used));
      used += granted;
      return granted;
    },
    give(n) {
      used = Math.max(0, used - n);
    },
  };
}

/** Phones and tablets get a smaller pool. */
export function defaultCap(): number {
  return matchMedia('(pointer: coarse)').matches ? 500 : 1500;
}
