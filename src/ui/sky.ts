/**
 * A still starfield and nebula painted once behind everything. It does not
 * move, so it is safe for people who prefer reduced motion.
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

    // Seeded so the sky looks the same on every load.
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, w, h);

    const clouds: [number, number, number, string][] = [
      [0.18, 0.25, 0.55, 'rgba(120, 70, 220, 0.28)'],
      [0.85, 0.2, 0.45, 'rgba(40, 150, 200, 0.2)'],
      [0.7, 0.85, 0.6, 'rgba(220, 70, 170, 0.16)'],
      [0.1, 0.9, 0.4, 'rgba(60, 90, 220, 0.18)'],
    ];
    const big = Math.max(w, h);
    for (const [cx, cy, r, color] of clouds) {
      const g = ctx.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, r * big);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    const count = Math.round((w * h) / 2600);
    const tints = ['255,255,255', '200,220,255', '255,230,210', '190,255,250'];
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const bright = rand();
      const r = bright > 0.985 ? 1.6 : bright > 0.9 ? 1.1 : 0.6;
      ctx.fillStyle = `rgba(${tints[Math.floor(rand() * tints.length)]},${0.35 + bright * 0.6})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (r > 1.5) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, 'rgba(200,220,255,0.35)');
        g.addColorStop(1, 'rgba(200,220,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 9, y - 9, 18, 18);
      }
    }

    // A touch of grain hides the banding that smooth 8-bit gradients get.
    // Without it, Color trip makes those bands stand out as lines.
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = img.data;
    let noise = 12345;
    for (let i = 0; i < px.length; i += 4) {
      noise ^= noise << 13;
      noise ^= noise >>> 17;
      noise ^= noise << 5;
      const n = ((noise >>> 0) / 4294967296 - 0.5) * 7;
      px[i] += n;
      px[i + 1] += n;
      px[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  };
  draw();
  let t = 0;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = window.setTimeout(draw, 120);
  });
}
