/**
 * Autopilot: when nobody has touched the page for a few seconds, a ghost
 * cursor drifts around and clicks now and then, so the effects show off by
 * themselves. Any real mouse, touch, pen, or key press takes over at once.
 */

const GHOST = Symbol('ghost');
type GhostEvent = Event & { [GHOST]?: true };

export interface AutopilotOptions {
  stage: HTMLElement;
  /** Checked every second. Autopilot only runs while this returns true. */
  allowed(): boolean;
  idleMs?: number;
}

export interface Autopilot {
  readonly active: boolean;
}

export function startAutopilot(opts: AutopilotOptions): Autopilot {
  const idleMs = opts.idleMs ?? 6000;
  let lastReal = performance.now();
  let active = false;
  let raf = 0;
  let started = 0;
  let nextClick = 0;

  const ghost = document.createElement('div');
  ghost.className = 'ghost-cursor';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.innerHTML =
    '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2 L2 21 L7 16 L11 24 L14.5 22.5 L10.5 14.8 L17.5 14.8 Z" fill="white" fill-opacity="0.85" stroke="#05060f" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const pill = document.createElement('p');
  pill.className = 'autopilot-pill';
  pill.setAttribute('aria-hidden', 'true');
  document.body.append(ghost, pill);

  const send = (type: string, x: number, y: number) => {
    const e = new PointerEvent(type, { clientX: x, clientY: y, pointerType: 'mouse', bubbles: true }) as GhostEvent;
    e[GHOST] = true;
    opts.stage.dispatchEvent(e);
  };

  /** The playable area: the screen minus the panel when it sits on the right. */
  const area = () => {
    const panel = document.getElementById('panel');
    const r = panel?.getBoundingClientRect();
    const sideways = r && r.left > innerWidth / 2 && r.height > innerHeight / 2;
    return { w: sideways ? r.left : innerWidth, h: sideways ? innerHeight : innerHeight - (r?.height ?? 0) };
  };

  const tick = (now: number) => {
    const t = (now - started) / 1000;
    const { w, h } = area();
    const x = w * 0.5 + Math.sin(t * 0.7) * w * 0.32 + Math.sin(t * 1.9) * w * 0.05;
    const y = h * 0.5 + Math.sin(t * 1.1 + 1) * h * 0.3;
    send('pointermove', x, y);
    if (t > nextClick) {
      send('pointerdown', x, y);
      send('pointerup', x, y);
      nextClick = t + 1.8 + Math.random() * 1.6;
    }
    ghost.style.transform = `translate(${x - 2}px, ${y - 2}px)`;
    raf = requestAnimationFrame(tick);
  };

  const begin = () => {
    active = true;
    started = performance.now();
    nextClick = 1;
    ghost.classList.add('on');
    pill.textContent = 'Autopilot is playing. Move or tap to take over.';
    pill.classList.add('on');
    raf = requestAnimationFrame(tick);
  };

  const end = () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    ghost.classList.remove('on');
    pill.classList.remove('on');
    pill.textContent = '';
    const e = new PointerEvent('pointerleave', { bubbles: false }) as GhostEvent;
    e[GHOST] = true;
    opts.stage.dispatchEvent(e);
  };

  const real = (e: Event) => {
    if ((e as GhostEvent)[GHOST]) return;
    lastReal = performance.now();
    end();
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
    addEventListener(type, real, { capture: true, passive: true });
  }

  setInterval(() => {
    const ok = opts.allowed() && !document.hidden;
    if (!ok) end();
    else if (!active && performance.now() - lastReal > idleMs) begin();
  }, 1000);

  return {
    get active() {
      return active;
    },
  };
}
