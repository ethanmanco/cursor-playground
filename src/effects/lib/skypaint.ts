/**
 * Paints a still night sky: a base color, a few soft nebula clouds, stars,
 * and a touch of grain (which hides the banding smooth 8-bit gradients get).
 * Shared by the page background and the Sky theme effect.
 */

export interface SkyTheme {
  base: string;
  clouds: [number, number, number, string][]; // x, y, radius (0..1), rgb "r,g,b"
}

export const SKY_THEMES: Record<string, SkyTheme> = {
  space: {
    base: '#05060f',
    clouds: [
      [0.18, 0.25, 0.55, '120,70,220'],
      [0.85, 0.2, 0.45, '40,150,200'],
      [0.7, 0.85, 0.6, '220,70,170'],
      [0.1, 0.9, 0.4, '60,90,220'],
    ],
  },
  nebula: {
    base: '#0b0418',
    clouds: [
      [0.25, 0.3, 0.6, '200,60,220'],
      [0.8, 0.25, 0.5, '90,60,255'],
      [0.6, 0.8, 0.65, '255,80,160'],
      [0.05, 0.75, 0.45, '120,40,200'],
    ],
  },
  ocean: {
    base: '#020c14',
    clouds: [
      [0.2, 0.2, 0.6, '20,140,170'],
      [0.85, 0.35, 0.5, '30,90,200'],
      [0.55, 0.9, 0.6, '20,190,160'],
    ],
  },
  sunset: {
    base: '#120610',
    clouds: [
      [0.5, 1.05, 0.75, '255,110,60'],
      [0.15, 0.75, 0.5, '230,60,120'],
      [0.85, 0.7, 0.5, '160,60,200'],
      [0.5, 0.1, 0.5, '60,40,140'],
    ],
  },
  void: { base: '#000000', clouds: [] },
};

export function paintSkyInto(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: SkyTheme,
  stars = 6,
  glow = 6,
): void {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  ctx.fillStyle = theme.base;
  ctx.fillRect(0, 0, w, h);

  const big = Math.max(w, h);
  const strength = glow / 6;
  for (const [cx, cy, r, color] of theme.clouds) {
    const g = ctx.createRadialGradient(cx * w, cy * h, 0, cx * w, cy * h, r * big);
    g.addColorStop(0, `rgba(${color},${Math.min(0.6, 0.22 * strength)})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const count = Math.round(((w * h) / 2600) * (stars / 6));
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

  // Grain, applied to the raw pixels.
  const canvas = ctx.canvas;
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
}
