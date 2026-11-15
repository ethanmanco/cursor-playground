import type { Cue } from '../engine/types';

/**
 * Optional sound effects, made on the fly with the Web Audio API (no audio
 * files to download). Everything is soft and short. Sounds pan left and
 * right with where they happen, drop in pitch during slow motion, and are
 * rate-limited so a busy screen never turns into noise.
 */

export interface Sound {
  /** Must be called from a click or key press the first time (browser rule). */
  setOn(on: boolean): void;
  readonly on: boolean;
  /** 'running' once the browser lets audio play. */
  readonly state: string;
  play(cue: Cue, x: number, strength: number, timeScale: number): void;
}

// Minimum seconds between two of the same sound.
const GAP: Record<Cue, number> = {
  firework: 0.06,
  confetti: 0.12,
  pop: 0.035,
  shockwave: 0.08,
  wish: 0.25,
  flare: 0.1,
  constellation: 0.4,
  collapse: 1,
  boom: 1,
};

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let on = false;
  const last: Partial<Record<Cue, number>> = {};

  const init = () => {
    if (ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };

  /** A gain node with a quick attack and a smooth fade, routed through a panner. */
  const voice = (at: number, peak: number, attack: number, decay: number, pan: number) => {
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    const p = ctx!.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(master!);
    return g;
  };

  const tone = (at: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, pan: number) => {
    const o = ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    o.connect(voice(at, peak, 0.005, dur, pan));
    o.start(at);
    o.stop(at + dur + 0.05);
  };

  const hiss = (at: number, filter: BiquadFilterType, f0: number, f1: number, dur: number, peak: number, pan: number, attack = 0.005) => {
    const src = ctx!.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx!.createBiquadFilter();
    f.type = filter;
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(f0, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + attack + dur);
    src.connect(f).connect(voice(at, peak, attack, dur, pan));
    src.start(at, Math.random() * 0.5);
    src.stop(at + attack + dur + 0.05);
  };

  return {
    get on() {
      return on;
    },
    get state() {
      return ctx?.state ?? 'none';
    },
    setOn(next) {
      on = next;
      if (on) {
        init();
        void ctx?.resume();
      } else {
        void ctx?.suspend();
      }
    },
    play(cue, x, strength, timeScale) {
      if (!on || !ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (now - (last[cue] ?? -1) < GAP[cue]) return;
      last[cue] = now;
      const pan = Math.max(-0.8, Math.min(0.8, (x / innerWidth) * 2 - 1));
      // Slow motion lowers the pitch; frozen time plays very low and soft.
      const pitch = 0.45 + 0.55 * Math.max(0, Math.min(1, timeScale));
      const s = Math.max(0.4, Math.min(1.5, strength));
      const v = (n: number) => n * s;
      const at = now + 0.005;

      switch (cue) {
        case 'pop': {
          const f = (700 + Math.random() * 500) * pitch;
          tone(at, 'sine', f, f * 0.4, 0.07, v(0.25), pan);
          break;
        }
        case 'firework': {
          hiss(at, 'bandpass', 2500 * pitch, 300 * pitch, 0.5, v(0.35), pan);
          // Crackle as the sparks burn out.
          for (let i = 0; i < 6; i++) {
            hiss(at + 0.35 + Math.random() * 0.5, 'highpass', 4000, 3000, 0.03, v(0.12), pan + (Math.random() - 0.5) * 0.3);
          }
          break;
        }
        case 'confetti': {
          hiss(at, 'highpass', 3000 * pitch, 2000 * pitch, 0.08, v(0.3), pan);
          tone(at + 0.02, 'triangle', 880 * pitch, 1320 * pitch, 0.12, v(0.08), pan);
          break;
        }
        case 'shockwave': {
          tone(at, 'sine', 160 * pitch, 45 * pitch, 0.5, v(0.4), pan);
          hiss(at, 'lowpass', 1200 * pitch, 150 * pitch, 0.45, v(0.18), pan);
          break;
        }
        case 'wish': {
          // A soft rising chime.
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(at + i * 0.07, 'sine', f * pitch, f * pitch, 0.9, v(0.12), pan));
          break;
        }
        case 'flare': {
          hiss(at, 'bandpass', 400 * pitch, 2400 * pitch, 0.35, v(0.2), pan, 0.08);
          break;
        }
        case 'constellation': {
          [659.25, 783.99, 987.77, 1174.66, 1318.51].forEach((f, i) => tone(at + i * 0.09, 'sine', f * pitch, f * pitch, 0.7, v(0.1), pan));
          break;
        }
        case 'collapse': {
          // A low rumble rising over the collapse.
          hiss(at, 'lowpass', 120 * pitch, 900 * pitch, 1.2, v(0.25), pan, 1.0);
          tone(at, 'sine', 55 * pitch, 110 * pitch, 1.3, v(0.25), pan);
          break;
        }
        case 'boom': {
          tone(at, 'sine', 90 * pitch, 28 * pitch, 1.6, v(0.6), pan);
          hiss(at, 'lowpass', 2500 * pitch, 100 * pitch, 1.4, v(0.45), pan);
          break;
        }
      }
    },
  };
}
