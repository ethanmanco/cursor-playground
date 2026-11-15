import type { Effect } from '../engine/types';
import { createShaderPass, NOISE_GLSL, type ShaderPass } from './lib/gl';

type S = { density: number; swirl: number; colors: number };

// Cosmic dust: faint, glowing gas and fine dust drifting among the stars,
// drawn by a WebGL shader. Real nebulae glow, so the gas is added as light
// on top of the sky instead of being painted over it: stars still shine
// through. Thin bright filaments run through the gas, tiny dust grains glint,
// and it all swirls gently around your cursor.

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uSwirl;
uniform float uDensity;
uniform float uHue;
${NOISE_GLSL}

vec3 gasColor(float t, float q) {
  vec3 teal = vec3(0.18, 0.55, 0.75);
  vec3 violet = vec3(0.5, 0.3, 0.85);
  vec3 rose = vec3(0.85, 0.35, 0.6);
  // A seamless loop: teal, violet, rose, and back to teal.
  float k = fract(t) * 3.0;
  vec3 c = k < 1.0 ? mix(teal, violet, smoothstep(0.0, 1.0, k))
         : k < 2.0 ? mix(violet, rose, smoothstep(0.0, 1.0, k - 1.0))
                   : mix(rose, teal, smoothstep(0.0, 1.0, k - 2.0));
  return mix(c, vec3(0.95, 0.75, 0.6), q * 0.25);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);

  // A gentle swirl around the cursor.
  vec2 d = p - m;
  float a = uSwirl * exp(-length(d) * 3.5);
  p = m + mat2(cos(a), -sin(a), sin(a), cos(a)) * d;

  float t = uTime;
  vec2 q = vec2(fbm(p * 1.6 + t * 0.03), fbm(p * 1.6 + vec2(5.2, 1.3) - t * 0.025));
  float f = fbm(p * 1.8 + 2.8 * q + vec2(t * 0.02, 0.0));

  // Broad glow, plus thin bright filaments where the noise folds over.
  float glow = smoothstep(0.45, 0.95, f);
  float ridge = 1.0 - abs(fbm(p * 3.2 + 1.5 * q - t * 0.015) * 2.0 - 1.0);
  float filaments = pow(ridge, 6.0) * smoothstep(0.35, 0.7, f);

  vec3 col = gasColor(f * 0.9 + length(q) * 0.5 + uHue, q.x);
  vec3 light = col * (glow * 0.55 + filaments * 0.9);

  // Tiny dust grains that glint softly inside the gas.
  vec2 cell = floor(gl_FragCoord.xy / 2.0);
  float grain = step(0.996, hash(cell)) * (0.5 + 0.5 * sin(t * 3.0 + hash(cell + 7.0) * 40.0));
  light += vec3(0.9, 0.9, 1.0) * grain * glow * 0.8;

  light *= uDensity;
  light += (hash(gl_FragCoord.xy + t) - 0.5) / 255.0;
  light = clamp(light, 0.0, 1.0);
  gl_FragColor = vec4(light, max(light.r, max(light.g, light.b)));
}
`;

let pass: ShaderPass | null = null;
let tried = false;
let mx = 0.5;
let my = 0.5;

export const smoke: Effect<S> = {
  id: 'smoke',
  name: 'Cosmic dust',
  blurb: 'Faint glowing gas and dust drift among the stars and swirl around you.',
  category: 'trippy',
  layer: 'back',
  settings: [
    { kind: 'range', key: 'density', label: 'Brightness', min: 1, max: 10, step: 1, default: 5 },
    { kind: 'range', key: 'swirl', label: 'Swirl', min: 0, max: 10, step: 1, default: 4 },
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
    // Rendered a bit under full size and stretched up smoothly: the gas is
    // soft, and dust grains are drawn in 2-pixel cells anyway.
    const scale = matchMedia('(pointer: coarse)').matches ? 0.5 : 0.8;
    pass.render(env.width * scale, env.height * scale, (gl) => {
      gl.uniform2f(pass!.uniform('uRes'), pass!.canvas.width, pass!.canvas.height);
      gl.uniform1f(pass!.uniform('uTime'), env.time * 0.6);
      gl.uniform2f(pass!.uniform('uMouse'), mx, my);
      gl.uniform1f(pass!.uniform('uSwirl'), s.swirl * 0.3);
      gl.uniform1f(pass!.uniform('uDensity'), 0.25 + s.density * 0.11);
      gl.uniform1f(pass!.uniform('uHue'), env.time * s.colors * 0.008);
    });
    const ctx = env.back;
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pass.canvas, 0, 0, env.width, env.height);
  },

  teardown() {},
};
