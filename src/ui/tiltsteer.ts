import type { Tilt } from '../engine/tilt';

/**
 * Tilt to steer: on a phone, a glowing marble rolls around the screen as you
 * tilt it, and the effects follow the marble as if it were your finger.
 * Touching the screen takes over; letting go hands control back to the
 * marble.
 */
export interface TiltSteer {
  set(on: boolean): void;
}

export function tiltSteer(stage: HTMLElement, tilt: Tilt): TiltSteer {
  const marble = document.createElement('div');
  marble.className = 'tilt-marble';
  marble.setAttribute('aria-hidden', 'true');
  document.body.append(marble);

  let on = false;
  let raf = 0;
  let last = 0;
  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let vx = 0;
  let vy = 0;
  let touching = false;

  stage.addEventListener('pointerdown', (e) => {
    if (e.isTrusted) touching = true;
  });
  const lift = (e: PointerEvent) => {
    if (!e.isTrusted) return;
    touching = false;
    // Pick up from wherever the finger let go.
    x = e.clientX;
    y = e.clientY;
    vx = vy = 0;
  };
  stage.addEventListener('pointerup', lift);
  stage.addEventListener('pointercancel', lift);

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!touching) {
      vx = (vx + tilt.x * 2200 * dt) * Math.pow(0.35, dt);
      vy = (vy + tilt.y * 2200 * dt) * Math.pow(0.35, dt);
      x += vx * dt;
      y += vy * dt;
      // Bounce softly off the edges.
      const pad = 12;
      if (x < pad || x > innerWidth - pad) {
        x = Math.min(innerWidth - pad, Math.max(pad, x));
        vx *= -0.45;
      }
      if (y < pad || y > innerHeight - pad) {
        y = Math.min(innerHeight - pad, Math.max(pad, y));
        vy *= -0.45;
      }
      stage.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'touch', bubbles: true }));
      marble.style.transform = `translate(${x}px, ${y}px)`;
    }
    marble.classList.toggle('on', !touching);
    raf = requestAnimationFrame(frame);
  };

  return {
    set(next) {
      if (next === on) return;
      on = next;
      cancelAnimationFrame(raf);
      if (on) {
        x = innerWidth / 2;
        y = innerHeight / 2;
        vx = vy = 0;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else {
        marble.classList.remove('on');
        stage.dispatchEvent(new PointerEvent('pointerleave', {}));
      }
    },
  };
}
