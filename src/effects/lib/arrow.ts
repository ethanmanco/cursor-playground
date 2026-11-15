/** Traces a classic arrow cursor (tip at x, y). Fill and stroke it yourself. */
export function arrowPath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const k = size / 20;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 19 * k);
  ctx.lineTo(x + 5 * k, y + 14 * k);
  ctx.lineTo(x + 9 * k, y + 22 * k);
  ctx.lineTo(x + 12.5 * k, y + 20.5 * k);
  ctx.lineTo(x + 8.5 * k, y + 12.8 * k);
  ctx.lineTo(x + 15.5 * k, y + 12.8 * k);
  ctx.closePath();
}
