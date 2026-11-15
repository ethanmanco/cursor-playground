import type { Effect, Env } from '../engine/types';
import { glowSprite, rgba } from './lib/color';

type S = { radius: number; dark: number; color: string };

// Lights out. A hidden sky waits in the dark: constellations, little solar
// systems, and shooting stars. Every star your beam touches stays lit.
// Find all the stars in a constellation and its lines draw in. Find every
// constellation and a brand new sky appears. Click to fire a flare that
// lights up a wide area for a moment.

interface MapStar {
  x: number;
  y: number;
  r: number;
  found: number; // 0 hidden, 1 discovered
  group: number;
  twinkle: number;
}

interface Group {
  stars: number[];
  edges: [number, number][];
  done: boolean;
  doneAt: number;
  cx: number;
  cy: number;
}

interface System {
  x: number;
  y: number;
  planets: { orbit: number; angle: number; speed: number; size: number }[];
}

interface Light {
  x: number;
  y: number;
  r: number;
  a: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const FLARE_LIFE = 1.8;

let stars: MapStar[] = [];
let groups: Group[] = [];
let systems: System[] = [];
const flares: { x: number; y: number; age: number }[] = [];
const meteors: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
const sparks: Spark[] = [];
let skyFor = '';
let dustFor = '';
let skyNumber = 0;
let newSkyAt = 0;
let nextMeteor = 2;
let lx = 0;
let ly = 0;

let dust: HTMLCanvasElement | null = null;
let mapC: HTMLCanvasElement | null = null;
let lightC: HTMLCanvasElement | null = null;
let darkC: HTMLCanvasElement | null = null;
let sprite: HTMLCanvasElement | null = null;
let spriteColor = '';

const canvas = (c: HTMLCanvasElement | null, w: number, h: number) => {
  const out = c ?? document.createElement('canvas');
  if (out.width !== w || out.height !== h) {
    out.width = w;
    out.height = h;
  }
  return out;
};

function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function buildSky(env: Env) {
  const { width: W, height: H } = env;
  const rand = seeded(97 + skyNumber * 7919);
  stars = [];
  groups = [];
  systems = [];

  const coarse = matchMedia('(pointer: coarse)').matches;
  const want = Math.max(4, Math.min(coarse ? 6 : 11, Math.round((W * H) / 120000)));
  const centers: { x: number; y: number }[] = [];
  const free = (x: number, y: number, gap: number) => centers.every((c) => Math.hypot(c.x - x, c.y - y) > gap);

  for (let tries = 0; groups.length < want && tries < 400; tries++) {
    const cx = 90 + rand() * (W - 180);
    const cy = 90 + rand() * (H - 180);
    if (!free(cx, cy, 190)) continue;
    centers.push({ x: cx, y: cy });
    const g: Group = { stars: [], edges: [], done: false, doneAt: 0, cx, cy };
    const count = 4 + Math.floor(rand() * 4);
    let x = cx - 40 + rand() * 20;
    let y = cy - 20 + rand() * 40;
    let heading = rand() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const idx = stars.length;
      stars.push({ x, y, r: 1.6 + rand() * 1.8, found: 0, group: groups.length, twinkle: rand() * 6 });
      if (i > 0) g.edges.push([g.stars[g.stars.length - 1], idx]);
      g.stars.push(idx);
      heading += (rand() - 0.5) * 2.2;
      const step = 34 + rand() * 38;
      x = Math.min(W - 30, Math.max(30, x + Math.cos(heading) * step));
      y = Math.min(H - 30, Math.max(30, y + Math.sin(heading) * step));
    }
    // One extra link back to an earlier star makes shapes less stringy.
    if (count > 4 && rand() < 0.6) g.edges.push([g.stars[count - 1], g.stars[Math.floor(rand() * (count - 2))]]);
    let sx = 0;
    let sy = 0;
    for (const i of g.stars) {
      sx += stars[i].x;
      sy += stars[i].y;
    }
    g.cx = sx / count;
    g.cy = sy / count;
    groups.push(g);
  }

  for (let tries = 0; systems.length < (coarse ? 1 : 3) && tries < 200; tries++) {
    const x = 100 + rand() * (W - 200);
    const y = 100 + rand() * (H - 200);
    if (!free(x, y, 150)) continue;
    centers.push({ x, y });
    const planets = [];
    const n = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      planets.push({ orbit: 28 + i * 24, angle: rand() * Math.PI * 2, speed: (0.6 - i * 0.15) * (rand() < 0.5 ? 1 : -1), size: 2.5 + rand() * 3.5 });
    }
    systems.push({ x, y, planets });
  }
}

/** Faint dust and nebula wisps, painted once per size and color. */
function paintDust(env: Env, color: string) {
  const { width: W, height: H, dpr } = env;
  const rand = seeded(13 + skyNumber * 31);
  dust = canvas(dust, Math.round(W * dpr), Math.round(H * dpr));
  const d = dust.getContext('2d')!;
  d.setTransform(dpr, 0, 0, dpr, 0, 0);
  d.clearRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 120 + rand() * 220;
    const g = d.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, 0.22));
    g.addColorStop(1, rgba(color, 0));
    d.fillStyle = g;
    d.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const specks = Math.round((W * H) / 1400);
  for (let i = 0; i < specks; i++) {
    d.fillStyle = rand() < 0.3 ? rgba(color, 0.7) : 'rgba(230,236,255,0.6)';
    d.fillRect(rand() * W, rand() * H, 1.2, 1.2);
  }
}

function lights(R: number, env: Env): Light[] {
  const out: Light[] = [{ x: lx, y: ly, r: R, a: 1 }];
  // Flashes from other effects (fireworks, supernova) light up the map too.
  for (const b of env.blasts) if (b.kind === 'light' && b.strength > 0.05) out.push({ x: b.x, y: b.y, r: b.radius, a: b.strength });
  for (const f of flares) {
    const grow = 1 - Math.pow(1 - Math.min(1, f.age / 0.35), 3);
    out.push({ x: f.x, y: f.y, r: R * (0.8 + 1.8 * grow), a: 1 - f.age / FLARE_LIFE });
  }
  return out;
}

export const flashlight: Effect<S> = {
  id: 'flashlight',
  name: 'Flashlight',
  blurb: 'Explore a hidden star map. Found stars stay lit. Click for a flare.',
  category: 'lighting',
  layer: 'front',
  settings: [
    { kind: 'range', key: 'radius', label: 'Beam size', min: 60, max: 300, step: 10, default: 160 },
    { kind: 'range', key: 'dark', label: 'Darkness', min: 30, max: 100, step: 5, default: 90, unit: '%' },
    { kind: 'color', key: 'color', label: 'Map color', default: '#8affc1' },
  ],

  setup(env) {
    lx = env.pointer.x;
    ly = env.pointer.y;
    skyFor = dustFor = '';
    newSkyAt = 0;
    flares.length = 0;
    meteors.length = 0;
  },

  onPointerDown(env) {
    flares.push({ x: env.pointer.x, y: env.pointer.y, age: 0 });
    env.cue('flare', env.pointer.x);
    if (flares.length > 3) flares.shift();
  },

  update(dt, env, s) {
    // Changing the color repaints the dust but keeps what you have found.
    const skyKey = `${env.width}|${env.height}|${skyNumber}`;
    if (skyKey !== skyFor) {
      buildSky(env);
      skyFor = skyKey;
    }
    const dustKey = `${skyKey}|${env.dpr}|${s.color}`;
    if (dustKey !== dustFor) {
      paintDust(env, s.color);
      dustFor = dustKey;
    }

    const ease = Math.min(1, dt * 14);
    lx += (env.pointer.x - lx) * ease;
    ly += (env.pointer.y - ly) * ease;
    for (const f of flares) f.age += dt;
    while (flares.length && flares[0].age > FLARE_LIFE) flares.shift();

    // Discover stars inside any light.
    const ls = lights(s.radius, env);
    for (const st of stars) {
      if (st.found >= 1) continue;
      for (const l of ls) {
        if (l.a > 0.15 && Math.hypot(st.x - l.x, st.y - l.y) < l.r * 0.7) {
          st.found = Math.min(1, st.found + dt * 4);
          break;
        }
      }
    }

    let done = 0;
    for (const g of groups) {
      if (!g.done && g.stars.every((i) => stars[i].found >= 1)) {
        g.done = true;
        g.doneAt = env.time;
        env.cue('constellation', g.cx);
        const n = env.budget.take(30);
        for (let i = 0; i < n; i++) {
          const st = stars[g.stars[i % g.stars.length]];
          const a = Math.random() * Math.PI * 2;
          const v = 30 + Math.random() * 90;
          sparks.push({ x: st.x, y: st.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.6 });
        }
      }
      if (g.done) done++;
    }
    if (groups.length && done === groups.length && !newSkyAt) newSkyAt = env.time + 6;
    if (newSkyAt && env.time > newSkyAt) {
      newSkyAt = 0;
      skyNumber++;
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const k = sparks[i];
      k.life -= dt;
      if (k.life <= 0) {
        sparks[i] = sparks[sparks.length - 1];
        sparks.pop();
        env.budget.give(1);
        continue;
      }
      k.vx *= 0.96;
      k.vy *= 0.96;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
    }

    nextMeteor -= dt;
    if (nextMeteor <= 0) {
      nextMeteor = 2 + Math.random() * 4;
      const fromLeft = Math.random() < 0.5;
      meteors.push({
        x: fromLeft ? -40 : env.width + 40,
        y: Math.random() * env.height * 0.6,
        vx: (fromLeft ? 1 : -1) * (500 + Math.random() * 300),
        vy: 180 + Math.random() * 160,
        life: 2.5,
      });
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;
      if (m.life <= 0) meteors.splice(i, 1);
    }
    for (const sys of systems) for (const p of sys.planets) p.angle += p.speed * dt;
  },

  draw(env, s) {
    const { width: W, height: H, dpr, time } = env;
    const ctx = env.front;
    if (!sprite || spriteColor !== s.color) {
      sprite = glowSprite(s.color, 48);
      spriteColor = s.color;
    }

    // 1. Light mask at half resolution (soft edges do not need more).
    const hw = Math.ceil(W / 2);
    const hh = Math.ceil(H / 2);
    lightC = canvas(lightC, hw, hh);
    const lc = lightC.getContext('2d')!;
    lc.setTransform(0.5, 0, 0, 0.5, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, W, H);
    lc.globalCompositeOperation = 'lighter';
    for (const l of lights(s.radius, env)) {
      const g = lc.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(255,255,255,${l.a})`);
      g.addColorStop(0.5, `rgba(255,255,255,${l.a * 0.9})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      lc.fillStyle = g;
      lc.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }

    // 2. Darkness with the lights cut out.
    darkC = canvas(darkC, hw, hh);
    const dc = darkC.getContext('2d')!;
    dc.globalCompositeOperation = 'source-over';
    dc.clearRect(0, 0, hw, hh);
    dc.fillStyle = `rgba(3,4,12,${s.dark / 100})`;
    dc.fillRect(0, 0, hw, hh);
    dc.globalCompositeOperation = 'destination-out';
    dc.drawImage(lightC, 0, 0);
    ctx.drawImage(darkC, 0, 0, W, H);

    // 3. The full hidden sky, shown only where light falls.
    mapC = canvas(mapC, Math.round(W * dpr), Math.round(H * dpr));
    const mc = mapC.getContext('2d')!;
    mc.setTransform(dpr, 0, 0, dpr, 0, 0);
    mc.globalCompositeOperation = 'source-over';
    mc.clearRect(0, 0, W, H);
    if (dust) mc.drawImage(dust, 0, 0, W, H);
    mc.lineCap = 'round';
    for (const sys of systems) {
      mc.strokeStyle = rgba(s.color, 0.45);
      mc.lineWidth = 1;
      for (const p of sys.planets) {
        mc.beginPath();
        mc.arc(sys.x, sys.y, p.orbit, 0, Math.PI * 2);
        mc.stroke();
      }
      mc.drawImage(sprite, sys.x - 16, sys.y - 16, 32, 32);
      mc.fillStyle = '#fff';
      mc.beginPath();
      mc.arc(sys.x, sys.y, 5, 0, Math.PI * 2);
      mc.fill();
      for (const p of sys.planets) {
        mc.fillStyle = s.color;
        mc.beginPath();
        mc.arc(sys.x + Math.cos(p.angle) * p.orbit, sys.y + Math.sin(p.angle) * p.orbit, p.size, 0, Math.PI * 2);
        mc.fill();
      }
    }
    for (const g of groups) {
      mc.strokeStyle = rgba(s.color, g.done ? 0.9 : 0.35);
      mc.lineWidth = g.done ? 1.6 : 1;
      for (const [a, b] of g.edges) {
        mc.beginPath();
        mc.moveTo(stars[a].x, stars[a].y);
        mc.lineTo(stars[b].x, stars[b].y);
        mc.stroke();
      }
    }
    for (const st of stars) {
      mc.drawImage(sprite, st.x - st.r * 4, st.y - st.r * 4, st.r * 8, st.r * 8);
      mc.fillStyle = '#ffffff';
      mc.beginPath();
      mc.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      mc.fill();
    }
    for (const m of meteors) {
      const tail = mc.createLinearGradient(m.x, m.y, m.x - m.vx * 0.25, m.y - m.vy * 0.25);
      tail.addColorStop(0, 'rgba(255,255,255,0.95)');
      tail.addColorStop(1, 'rgba(255,255,255,0)');
      mc.strokeStyle = tail;
      mc.lineWidth = 2;
      mc.beginPath();
      mc.moveTo(m.x, m.y);
      mc.lineTo(m.x - m.vx * 0.25, m.y - m.vy * 0.25);
      mc.stroke();
    }
    mc.setTransform(1, 0, 0, 1, 0, 0);
    mc.globalCompositeOperation = 'destination-in';
    mc.drawImage(lightC, 0, 0, mapC.width, mapC.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(mapC, 0, 0, W, H);

    // 4. What you have found keeps glowing through the dark.
    ctx.lineCap = 'round';
    for (const g of groups) {
      // Lines appear as soon as both of their stars are found.
      const age = g.done ? Math.min(1, (time - g.doneAt) / 0.9) : 0;
      for (const [a, b] of g.edges) {
        const A = stars[a];
        const B = stars[b];
        if (A.found < 1 || B.found < 1) continue;
        ctx.strokeStyle = rgba(s.color, g.done ? 0.35 + 0.45 * (1 - age) + 0.1 * Math.sin(time * 2 + a) : 0.22);
        ctx.lineWidth = g.done ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
      if (g.done && age < 1) {
        const r = 20 + age * 120;
        ctx.strokeStyle = rgba(s.color, 0.7 * (1 - age));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const st of stars) {
      if (st.found <= 0) continue;
      const tw = 0.75 + 0.25 * Math.sin(time * 2.5 + st.twinkle);
      const done = groups[st.group]?.done;
      const r = st.r * (done ? 5 : 3.6) * tw;
      ctx.globalAlpha = st.found * (done ? 0.95 : 0.7);
      ctx.drawImage(sprite, st.x - r, st.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    for (const k of sparks) {
      ctx.fillStyle = rgba(s.color, Math.min(1, k.life * 1.5));
      ctx.fillRect(k.x - 1, k.y - 1, 2, 2);
    }
  },

  resize() {
    skyFor = dustFor = '';
  },

  teardown(env) {
    env.budget.give(sparks.length);
    sparks.length = 0;
    flares.length = 0;
    meteors.length = 0;
    skyFor = dustFor = '';
  },
};
