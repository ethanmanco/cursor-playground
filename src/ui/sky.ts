import { paintSkyInto, SKY_THEMES } from '../effects/lib/skypaint';

/**
 * A still starfield and nebula painted once behind everything. It does not
 * move, so it is safe for people who prefer reduced motion. The Sky theme
 * effect can paint a different one on top.
 */
export function paintSky(canvas: HTMLCanvasElement): void {
  const draw = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = innerWidth;
    const h = innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintSkyInto(ctx, w, h, SKY_THEMES.space);
  };
  draw();
  let t = 0;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = window.setTimeout(draw, 120);
  });
}
