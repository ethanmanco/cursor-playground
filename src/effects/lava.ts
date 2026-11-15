import type { Effect, Env } from '../engine/types';

type S = { blobs: number; size: number; speed: number };

// Glossy lava lamp blobs. This is the one effect that uses WebGL: a small
// shader works out the "goo" field for every pixel on the GPU, shades it
// like a shiny 3D surface, and colors it with a smooth rainbow. The result
// is copied onto the background layer. Without WebGL it falls back to soft
// glowing circles.

const MAX = 16;

interface Blob {
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  phase: number;
  r: number;
}

const blobs: Blob[] = [];
let mx = 0;
let my = 0;

let glCanvas: HTMLCanvasElement | null = null;
let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | null = null;
let loc: Record<string, WebGLUniformLocation | null> = {};
let triedGl = false;

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec3 uBlobs[${MAX}];
uniform int uCount;
uniform float uShift;
uniform float uScale;

vec3 rainbow(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float f = 0.0;
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    // Each blob reaches only 1.46x its radius, so blobs stay separate
    // until they drift close, then melt together.
    vec2 d = p - uBlobs[i].xy;
    float R = uBlobs[i].z * 1.46;
    float q = 1.0 - dot(d, d) / (R * R);
    if (q <= 0.0) continue;
    f += q * q * q;
    g += 3.0 * q * q * (-2.0 * d / (R * R));
  }

  // Shade the goo like a glossy surface: steep near the edges, flat inside.
  vec3 n = normalize(vec3(-g * uScale, 1.0));
  vec3 light = normalize(vec3(-0.45, -0.55, 0.7));
  float diffuse = max(dot(n, light), 0.0);
  float spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float rim = pow(1.0 - n.z, 2.0);

  float t = uShift + p.y / uRes.y * 0.45 + min(f, 2.0) * 0.12;
  vec3 col = rainbow(t);
  col = col * (0.45 + 0.65 * diffuse) + spec * 0.85 + rim * rainbow(t + 0.3) * 0.5;

  float body = smoothstep(0.12, 0.17, f);
  float glow = smoothstep(0.0, 0.15, f) * 0.3;
  float alpha = body * 0.95 + glow * (1.0 - body);
  vec3 outCol = mix(rainbow(t) * 0.9, col, body);
  gl_FragColor = vec4(outCol * alpha, alpha);
}
`;

function initGl(): boolean {
  triedGl = true;
  glCanvas = document.createElement('canvas');
  gl = glCanvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
  if (!gl) return false;
  const compile = (type: number, src: string) => {
    const sh = gl!.createShader(type)!;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    return gl!.getShaderParameter(sh, gl!.COMPILE_STATUS) ? sh : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) {
    gl = null;
    return false;
  }
  program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl = null;
    return false;
  }
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  // One big triangle that covers the whole screen.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  loc = {};
  for (const name of ['uRes', 'uBlobs', 'uCount', 'uShift', 'uScale']) loc[name] = gl.getUniformLocation(program, name);
  return true;
}

function positions(env: Env, s: S): number[] {
  const t = env.time;
  const out: number[] = [];
  for (const b of blobs) {
    out.push(
      env.width * (0.5 + b.ax * Math.sin(t * b.fx * 2 + b.phase)),
      env.height * (0.5 + b.ay * Math.cos(t * b.fy * 2 + b.phase * 1.3)),
      s.size * b.r,
    );
  }
  if (env.pointer.inside) out.push(mx, my, s.size * 0.85);
  return out;
}

export const lava: Effect<S> = {
  id: 'lava',
  name: 'Lava lamp',
  blurb: 'Glossy goo blobs drift, melt together, and follow you.',
  category: 'trippy',
  layer: 'back',
  settings: [
    { kind: 'range', key: 'blobs', label: 'Blobs', min: 3, max: 12, step: 1, default: 7 },
    { kind: 'range', key: 'size', label: 'Blob size', min: 40, max: 160, step: 10, default: 90 },
    { kind: 'range', key: 'speed', label: 'Color speed', min: 0, max: 10, step: 1, default: 4 },
  ],

  setup(env) {
    blobs.length = 0;
    mx = env.pointer.x;
    my = env.pointer.y;
    if (!triedGl) initGl();
  },

  update(dt, env, s) {
    const want = Math.round(s.blobs);
    while (blobs.length < want) {
      blobs.push({
        ax: 0.12 + Math.random() * 0.33,
        ay: 0.12 + Math.random() * 0.33,
        fx: 0.05 + Math.random() * 0.12,
        fy: 0.05 + Math.random() * 0.12,
        phase: Math.random() * Math.PI * 2,
        r: 0.5 + Math.random() * 0.5,
      });
    }
    blobs.length = want;
    const ease = Math.min(1, dt * 4);
    mx += (env.pointer.x - mx) * ease;
    my += (env.pointer.y - my) * ease;
  },

  draw(env, s) {
    const pts = positions(env, s);
    const ctx = env.back;

    if (!gl || !glCanvas) {
      // Fallback: soft glowing circles.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < pts.length; i += 3) {
        const hue = (env.time * s.speed * 10 + i * 20) % 360;
        const g = ctx.createRadialGradient(pts[i], pts[i + 1], 0, pts[i], pts[i + 1], pts[i + 2]);
        g.addColorStop(0, `hsla(${hue},100%,65%,0.8)`);
        g.addColorStop(1, `hsla(${hue},100%,65%,0)`);
        ctx.fillStyle = g;
        ctx.fillRect(pts[i] - pts[i + 2], pts[i + 1] - pts[i + 2], pts[i + 2] * 2, pts[i + 2] * 2);
      }
      return;
    }

    // Render at up to 1.5x on sharp screens. The goo is smooth, so more
    // pixels would cost speed without looking better.
    const scale = Math.min(env.dpr, 1.5);
    const w = Math.round(env.width * scale);
    const h = Math.round(env.height * scale);
    if (glCanvas.width !== w || glCanvas.height !== h) {
      glCanvas.width = w;
      glCanvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const data = new Float32Array(MAX * 3);
    const count = Math.min(MAX, pts.length / 3);
    for (let i = 0; i < count * 3; i++) data[i] = pts[i] * scale;
    gl.uniform2f(loc.uRes, w, h);
    gl.uniform3fv(loc.uBlobs, data);
    gl.uniform1i(loc.uCount, count);
    gl.uniform1f(loc.uShift, env.time * s.speed * 0.02);
    gl.uniform1f(loc.uScale, s.size * scale * 0.9);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    ctx.drawImage(glCanvas, 0, 0, env.width, env.height);
  },

  teardown() {
    blobs.length = 0;
  },
};
