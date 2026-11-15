import type { Effect } from '../engine/types';
import { createShaderPass, NOISE_GLSL, type ShaderPass } from './lib/gl';

type S = { density: number; swirl: number; colors: number };

// Cosmic smoke: slow, colorful clouds of nebula gas drawn by a WebGL shader.
// Noise is folded into itself a few times (domain warping), which makes the
// wispy, marbled shapes. The gas swirls gently around your cursor.

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uSwirl;
uniform float uDensity;
uniform float uHue;
${NOISE_GLSL}

// A looping nebula palette: deep blue, magenta, cyan, and back.
vec3 palette(float t) {
  vec3 blue = vec3(0.2, 0.25, 0.85);
  vec3 magenta = vec3(0.9, 0.28, 0.78);
  vec3 cyan = vec3(0.3, 0.85, 0.95);
  float k = fract(t) * 3.0;
  if (k < 1.0) return mix(blue, magenta, smoothstep(0.0, 1.0, k));
  if (k < 2.0) return mix(magenta, cyan, smoothstep(0.0, 1.0, k - 1.0));
  return mix(cyan, blue, smoothstep(0.0, 1.0, k - 2.0));
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);

  // Swirl the gas around the cursor, strongest close to it.
  vec2 d = p - m;
  float r = length(d);
  float a = uSwirl * exp(-r * 3.0);
  p = m + mat2(cos(a), -sin(a), sin(a), cos(a)) * d;

  float t = uTime;
  vec2 q = vec2(fbm(p * 1.4 + t * 0.05), fbm(p * 1.4 + vec2(5.2, 1.3) - t * 0.04));
  vec2 w = vec2(fbm(p * 1.4 + 3.5 * q + vec2(1.7, 9.2) + t * 0.06),
                fbm(p * 1.4 + 3.5 * q + vec2(8.3, 2.8) - t * 0.05));
  float f = fbm(p * 1.4 + 3.5 * w);

  vec3 col = palette(f * 1.3 + length(q) * 0.7 + uHue);
  col = mix(col, vec3(1.0), smoothstep(0.75, 1.0, f) * 0.35);
  float alpha = smoothstep(0.35, 0.9, f) * uDensity;
  col += (hash(gl_FragCoord.xy + t) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}
`;

let pass: ShaderPass | null = null;
let tried = false;
let mx = 0.5;
let my = 0.5;

export const smoke: Effect<S> = {
  id: 'smoke',
  name: 'Cosmic smoke',
  blurb: 'Colorful nebula gas drifts slowly and swirls around your cursor.',
  category: 'trippy',
  layer: 'back',
  settings: [
    { kind: 'range', key: 'density', label: 'Density', min: 1, max: 10, step: 1, default: 4 },
    { kind: 'range', key: 'swirl', label: 'Swirl', min: 0, max: 10, step: 1, default: 5 },
    { kind: 'range', key: 'colors', label: 'Color drift', min: 0, max: 10, step: 1, default: 3 },
  ],

  setup() {
    if (!tried) {
      tried = true;
      pass = createShaderPass(FRAG);
    }
  },

  update(dt, env) {
    const p = env.pointer;
    const ease = Math.min(1, dt * 2);
    mx += (p.x / env.width - mx) * ease;
    my += (1 - p.y / env.height - my) * ease;
  },

  draw(env, s) {
    if (!pass) return; // Needs WebGL; without it the effect simply shows nothing.
    // The gas is soft, so a bit under full size (smoothly stretched up)
    // looks the same and saves work. Phones go lower.
    const scale = matchMedia('(pointer: coarse)').matches ? 0.4 : 0.75;
    pass.render(env.width * scale, env.height * scale, (gl) => {
      gl.uniform2f(pass!.uniform('uRes'), pass!.canvas.width, pass!.canvas.height);
      gl.uniform1f(pass!.uniform('uTime'), env.time * 0.6);
      gl.uniform2f(pass!.uniform('uMouse'), mx, my);
      gl.uniform1f(pass!.uniform('uSwirl'), s.swirl * 0.35);
      gl.uniform1f(pass!.uniform('uDensity'), 0.15 + s.density * 0.065);
      gl.uniform1f(pass!.uniform('uHue'), env.time * s.colors * 0.01);
    });
    const ctx = env.back;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pass.canvas, 0, 0, env.width, env.height);
  },

  teardown() {},
};
