import { paintSkyInto, SKY_THEMES, skyState } from '../effects/lib/skypaint';

/**
 * A still starfield and nebula painted once behind everything. It does not
 * move, so it is safe for people who prefer reduced motion. A starless copy
 * is made when needed: the supernova swaps it in while it moves the stars.
 */
export function paintSky(canvas: HTMLCanvasElement): void {
  let withStars: HTMLCanvasElement | null = null;
  let without: HTMLCanvasElement | null = null;

  const make = (stars: boolean) => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.round(innerWidth * dpr);
    c.height = Math.round(innerHeight * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintSkyInto(ctx, innerWidth, innerHeight, SKY_THEMES.space, 6, 6, stars);
    return c;
  };

  const show = () => {
    const ctx = canvas.getContext('2d');
    if (skyState.starsHidden) without ??= make(false);
    const src = skyState.starsHidden ? without : withStars;
    if (!ctx || !src) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(src, 0, 0);
  };

  const draw = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    withStars = make(true);
    without = null;
    show();
    // Paint the starless copy a moment later, while the page is idle.
    window.setTimeout(() => (without ??= make(false)), 1500);
  };

  skyState.listeners.add(show);
  draw();
  let t = 0;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = window.setTimeout(draw, 120);
  });
}
