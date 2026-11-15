import type { Effect } from '../engine/types';
import { glowSprite, hexToHue, rgba } from './lib/color';

type S = { shape: string; color: string; size: number };

// Swaps the normal arrow for a custom cursor. Elements marked
// data-cp-keep-cursor (like the control panel) keep their usual cursor.
const STYLE_ID = 'cp-cursor-style';
const HIDDEN = 'cp-cursor-hidden';

let rx = 0; // lagging ring position
let ry = 0;
let angle = -Math.PI / 4;
let press = 0;
let sprite: HTMLCanvasElement | null = null;
let spriteColor = '';
const flame: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

function hideSystemCursor(on: boolean) {
  if (on && !document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      `html.${HIDDEN}, html.${HIDDEN} *:not([data-cp-keep-cursor]):not([data-cp-keep-cursor] *) { cursor: none !important; }` +
      // Cursor is inherited, so give kept areas a normal one again.
      `html.${HIDDEN} [data-cp-keep-cursor] { cursor: auto; }`;
    document.head.append(style);
  }
  document.documentElement.classList.toggle(HIDDEN, on);
}

function star(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
}

export const customCursor: Effect<S> = {
  id: 'cursor',
  name: 'Custom cursor',
  blurb: 'Swap the arrow for an orb, a ring, a rocket, a UFO, or a star.',
  category: 'cursor',
  layer: 'front',
  settings: [
    {
      kind: 'choice',
      key: 'shape',
      label: 'Shape',
      options: [
        { value: 'rocket', label: 'Rocket' },
        { value: 'ufo', label: 'UFO' },
        { value: 'orb', label: 'Orb' },
        { value: 'ring', label: 'Ring' },
        { value: 'star', label: 'Star' },
      ],
      default: 'rocket',
    },
    { kind: 'color', key: 'color', label: 'Color', default: '#ff7ad9' },
    { kind: 'range', key: 'size', label: 'Size', min: 12, max: 40, step: 2, default: 22 },
  ],

  setup(env) {
    rx = env.pointer.x;
    ry = env.pointer.y;
    hideSystemCursor(true);
  },

  update(dt, env, s) {
    const p = env.pointer;
    const ease = Math.min(1, dt * 12);
    rx += (p.x - rx) * ease;
    ry += (p.y - ry) * ease;
    press += ((p.down ? 1 : 0) - press) * Math.min(1, dt * 20);
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 40) {
      const target = Math.atan2(p.vy, p.vx);
      let diff = target - angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      angle += diff * Math.min(1, dt * 10);
    }
    if (s.shape === 'rocket' && p.inside && speed > 60 && flame.length < 60) {
      const n = Math.min(4, Math.ceil(speed / 300));
      for (let i = 0; i < n; i++) {
        const back = angle + Math.PI + (Math.random() - 0.5) * 0.6;
        const tail = s.size * 0.75;
        flame.push({
          x: p.x - Math.cos(angle) * tail,
          y: p.y - Math.sin(angle) * tail,
          vx: Math.cos(back) * (60 + Math.random() * 80),
          vy: Math.sin(back) * (60 + Math.random() * 80),
          life: 0.25 + Math.random() * 0.2,
        });
      }
    }
    for (let i = flame.length - 1; i >= 0; i--) {
      const f = flame[i];
      f.life -= dt;
      if (f.life <= 0) {
        flame.splice(i, 1);
        continue;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
  },

  draw(env, s) {
    const p = env.pointer;
    const ctx = env.front;
    if (!sprite || spriteColor !== s.color) {
      sprite = glowSprite(s.color, 64);
      spriteColor = s.color;
    }
    const hue = hexToHue(s.color);
    const size = s.size * (1 - press * 0.15);

    if (flame.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flame) {
        const r = 3 + f.life * 14;
        ctx.globalAlpha = Math.min(1, f.life * 3);
        ctx.drawImage(sprite, f.x - r, f.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!p.inside) return;

    ctx.save();
    switch (s.shape) {
      case 'orb': {
        const pulse = 1 + Math.sin(env.time * 4) * 0.08;
        const r = size * 1.4 * pulse;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'ring': {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(rx, ry, size * (0.85 + press * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'star': {
        ctx.translate(p.x, p.y);
        ctx.rotate(env.time * 1.5);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(sprite, -size * 1.3, -size * 1.3, size * 2.6, size * 2.6);
        ctx.globalCompositeOperation = 'source-over';
        star(ctx, size * 0.75);
        ctx.fillStyle = `hsl(${hue},100%,72%)`;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
      case 'ufo': {
        const wobble = Math.sin(env.time * 3) * 0.12 + Math.max(-0.4, Math.min(0.4, p.vx / 2000));
        ctx.translate(p.x, p.y);
        ctx.rotate(wobble);
        if (p.down) {
          const beam = ctx.createLinearGradient(0, 0, 0, size * 3);
          beam.addColorStop(0, rgba(s.color, 0.55));
          beam.addColorStop(1, rgba(s.color, 0));
          ctx.fillStyle = beam;
          ctx.beginPath();
          ctx.moveTo(-size * 0.35, size * 0.2);
          ctx.lineTo(size * 0.35, size * 0.2);
          ctx.lineTo(size * 1.1, size * 3);
          ctx.lineTo(-size * 1.1, size * 3);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(200,240,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(0, -size * 0.12, size * 0.42, size * 0.38, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#c9cde8';
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
          const on = Math.floor(env.time * 6 + i) % 2 === 0;
          ctx.fillStyle = on ? s.color : rgba(s.color, 0.35);
          ctx.beginPath();
          ctx.arc((i - 2) * size * 0.36, size * 0.06, size * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: {
        // Rocket, pointing the way you move. The nose sits on the pointer.
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        const L = size;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(-L * 0.55, -L * 0.18);
        ctx.lineTo(-L * 0.85, -L * 0.42);
        ctx.lineTo(-L * 0.62, -L * 0.05);
        ctx.lineTo(-L * 0.62, L * 0.05);
        ctx.lineTo(-L * 0.85, L * 0.42);
        ctx.lineTo(-L * 0.55, L * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#eef0ff';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-L * 0.2, -L * 0.24, -L * 0.62, -L * 0.2);
        ctx.lineTo(-L * 0.62, L * 0.2);
        ctx.quadraticCurveTo(-L * 0.2, L * 0.24, 0, 0);
        ctx.fill();
        ctx.fillStyle = `hsl(${hue + 180},70%,55%)`;
        ctx.beginPath();
        ctx.arc(-L * 0.3, 0, L * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  teardown() {
    flame.length = 0;
    hideSystemCursor(false);
  },
};
