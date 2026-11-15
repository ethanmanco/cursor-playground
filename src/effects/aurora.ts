import type { Effect } from '../engine/types';
import { createShaderPass, NOISE_GLSL, rgb01, type ShaderPass } from './lib/gl';

type S = { color: string; height: number; speed: number };

// Northern lights, drawn by a WebGL shader. Three curtains of light hang
// across the sky. Soft noise folds them, fine streaks run up them like real
// aurora rays, and the curtain nearest your cursor leans toward it and glows
// brighter. Without WebGL it falls back to soft glowing bands.

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uTop;
uniform vec2 uMouse;
uniform float uNear;
uniform float uHeight;
${NOISE_GLSL}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float x = uv.x * aspect;
  vec3 col = vec3(0.0);

  for (int i = 0; i < 3; i++) {
    float c = float(i);
    float t = uTime * (1.0 + c * 0.25);
    // Where the bottom edge of this curtain sits, gently folding.
    float fold = fbm(vec2(x * 0.7 + t * 0.04 + c * 3.1, t * 0.02 + c));
    float base = 0.42 + c * 0.1 + (fold - 0.5) * 0.4;
    // Lean toward the cursor.
    float pull = exp(-pow((uv.x - uMouse.x) * aspect, 2.0) / 0.06) * uNear;
    base = mix(base, uMouse.y - 0.04, pull * 0.3);

    float height = uHeight * (0.55 + 0.7 * fbm(vec2(x * 1.3 - t * 0.03, c * 5.0)));
    float d = uv.y - base;
    // Crisp-ish bottom edge, long soft fade upward.
    float shape = smoothstep(-0.035, 0.012, d) * exp(-max(d, 0.0) / height * 2.4);
    // Rays: thin vertical streaks that drift sideways.
    float rays = fbm(vec2(x * 22.0 + t * 0.12 + c * 11.0, uv.y * 0.8 - t * 0.05));
    rays = 0.35 + 0.65 * smoothstep(0.25, 0.75, rays);

    float glow = shape * rays * (0.85 + pull * 0.9) * (1.0 - c * 0.2);
    vec3 tint = mix(uColor, uTop, smoothstep(0.0, height * 1.2, d));
    col += tint * glow * 1.05;
  }

  // Tiny noise breaks up any banding in the smooth glow.
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  col = max(col, 0.0);
  float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(1.0)), alpha);
}
`;

let pass: ShaderPass | null = null;
let tried = false;
let mx = 0.5;
let my = 0.5;
let near = 0;

/** A cooler, violet tint for the tops of the curtains. */
function topTint(color: [number, number, number]): [number, number, number] {
  const [r, g, b] = color;
  return [Math.min(1, r * 0.4 + 0.45), Math.min(1, g * 0.25 + 0.15), Math.min(1, b * 0.5 + 0.7)];
}

export const aurora: Effect<S> = {
  id: 'aurora',
  name: 'Aurora',
  blurb: 'Soft northern lights ripple across the sky and lean toward you.',
  category: 'background',
  layer: 'back',
  settings: [
    { kind: 'color', key: 'color', label: 'Color', default: '#4dffb0' },
    { kind: 'range', key: 'height', label: 'Height', min: 20, max: 80, step: 5, default: 50, unit: '%' },
    { kind: 'range', key: 'speed', label: 'Speed', min: 1, max: 10, step: 1, default: 3 },
  ],

  setup() {
    near = 0;
    if (!tried) {
      tried = true;
      pass = createShaderPass(FRAG);
    }
  },

  update(dt, env) {
    const p = env.pointer;
    const ease = Math.min(1, dt * 3);
    mx += (p.x / env.width - mx) * ease;
    my += (1 - p.y / env.height - my) * ease;
    near += ((p.inside ? 1 : 0) - near) * Math.min(1, dt * 2);
  },

  draw(env, s) {
    const ctx = env.back;
    const color = rgb01(s.color);
    if (!pass) {
      // Fallback: three soft glowing bands.
      ctx.globalCompositeOperation = 'lighter';
      for (let c = 0; c < 3; c++) {
        const y = env.height * (0.58 - c * 0.1);
        const g = ctx.createLinearGradient(0, y - env.height * (s.height / 100) * 0.5, 0, y);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, s.color);
        ctx.globalAlpha = 0.25 - c * 0.05;
        ctx.fillStyle = g;
        ctx.fillRect(0, y - env.height * (s.height / 100) * 0.5, env.width, env.height * (s.height / 100) * 0.5);
      }
      return;
    }
    // Rendered at a bit under full size: the glow is soft, rays stay sharp.
    const scale = Math.min(env.dpr, 1) * 0.75;
    const top = topTint(color);
    pass.render(env.width * scale, env.height * scale, (gl) => {
      gl.uniform2f(pass!.uniform('uRes'), pass!.canvas.width, pass!.canvas.height);
      gl.uniform1f(pass!.uniform('uTime'), env.time * s.speed * 0.35);
      gl.uniform3f(pass!.uniform('uColor'), color[0], color[1], color[2]);
      gl.uniform3f(pass!.uniform('uTop'), top[0], top[1], top[2]);
      gl.uniform2f(pass!.uniform('uMouse'), mx, my);
      gl.uniform1f(pass!.uniform('uNear'), near);
      gl.uniform1f(pass!.uniform('uHeight'), (s.height / 100) * 0.55);
    });
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pass.canvas, 0, 0, env.width, env.height);
  },

  teardown() {},
};
