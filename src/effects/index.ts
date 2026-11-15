import type { Effect } from '../engine/types';
import { warp } from './warp';
import { parallax } from './parallax';
import { constellation } from './constellation';
import { dotGrid } from './dotgrid';
import { watchingEyes } from './eyes';
import { flashlight } from './flashlight';
import { ink } from './ink';
import { paint } from './paint';
import { gravity } from './gravity';
import { boids } from './boids';
import { ribbon } from './ribbon';
import { comet } from './comet';
import { trail } from './trail';
import { confetti } from './confetti';
import { fireworks } from './fireworks';
import { shockwave } from './shockwave';
import { customCursor } from './cursor';

/**
 * Every effect, in draw order (earlier draws underneath). The panel groups
 * them by category, so this order only matters for layering.
 *
 * To add an effect: write src/effects/<id>.ts (the file name must match the
 * effect id, which is how "Copy code" finds it) and add it here.
 */
export const EFFECTS: Effect[] = [
  warp,
  parallax,
  constellation,
  dotGrid,
  watchingEyes,
  flashlight,
  ink,
  paint,
  gravity,
  ribbon,
  boids,
  comet,
  trail,
  confetti,
  fireworks,
  shockwave,
  customCursor,
];
