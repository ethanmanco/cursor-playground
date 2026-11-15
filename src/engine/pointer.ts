import type { Pointer } from './types';

export interface PointerTracker {
  pointer: Pointer;
  /** Call once per frame before effects update. */
  beginFrame(dt: number): void;
  /** Call once per frame after effects draw. */
  endFrame(): void;
}

/**
 * Tracks one pointer (mouse, touch or pen) over the stage element using
 * Pointer Events. `onDown` fires for clicks and taps.
 */
export function trackPointer(stage: HTMLElement, onDown: () => void): PointerTracker {
  const pointer: Pointer = {
    x: innerWidth / 2,
    y: innerHeight / 2,
    px: innerWidth / 2,
    py: innerHeight / 2,
    vx: 0,
    vy: 0,
    down: false,
    inside: false,
    type: 'mouse',
  };
  let lastX = pointer.x;
  let lastY = pointer.y;
  // Set when the pointer reappears somewhere new, so effects do not draw a
  // long streak from the old position.
  let jumped = true;

  const place = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.type = e.pointerType === 'touch' || e.pointerType === 'pen' ? e.pointerType : 'mouse';
  };

  stage.addEventListener('pointermove', (e) => {
    if (!pointer.inside) jumped = true;
    place(e);
    // A touch that is only hovering (pen) still counts; a lifted finger does not move.
    pointer.inside = true;
  });

  stage.addEventListener('pointerdown', (e) => {
    if (!pointer.inside) jumped = true;
    place(e);
    pointer.inside = true;
    pointer.down = true;
    onDown();
  });

  const release = (e: PointerEvent) => {
    pointer.down = false;
    if (e.pointerType !== 'mouse') pointer.inside = false;
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('pointerleave', () => {
    pointer.inside = false;
    pointer.down = false;
  });

  return {
    pointer,
    beginFrame(dt) {
      if (jumped) {
        lastX = pointer.x;
        lastY = pointer.y;
        jumped = false;
      }
      pointer.px = lastX;
      pointer.py = lastY;
      const k = dt > 0 ? 1 / dt : 0;
      // Smooth velocity a little so effects do not twitch.
      pointer.vx = pointer.vx * 0.5 + (pointer.x - lastX) * k * 0.5;
      pointer.vy = pointer.vy * 0.5 + (pointer.y - lastY) * k * 0.5;
    },
    endFrame() {
      lastX = pointer.x;
      lastY = pointer.y;
    },
  };
}
