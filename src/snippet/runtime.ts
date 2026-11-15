import { Engine } from '../engine/engine';
import { splitHeading } from '../engine/split';
import type { Effect, Values } from '../engine/types';

/**
 * The tiny host used by "Copy code". It puts one see-through canvas over the
 * page (clicks pass straight through) and runs a single effect on it.
 */
export function runSnippet(effect: Effect, values: Values): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const start = () => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '2147483000',
    });
    document.body.append(canvas);

    const heading = (document.querySelector('[data-repel]') ?? document.querySelector('h1') ?? document.body) as HTMLElement;
    if (effect.id === 'repel') splitHeading(heading);

    const engine = new Engine({
      stage: document.documentElement,
      back: canvas,
      front: canvas,
      heading,
      registry: [effect],
    });
    engine.enable(effect, values);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
