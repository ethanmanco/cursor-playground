import type { Effect } from '../engine/types';
import { parallax } from './parallax';
import { constellation } from './constellation';
import { dotGrid } from './dotgrid';
import { watchingEyes } from './eyes';
import { flashlight } from './flashlight';
import { ink } from './ink';
import { paint } from './paint';
import { ribbon } from './ribbon';
import { comet } from './comet';
import { trail } from './trail';
import { fireworks } from './fireworks';
import { repel } from './repel';

/**
 * Every effect, in draw order (earlier draws underneath). The panel groups
 * them by category, so this order only matters for layering.
 *
 * To add an effect: write src/effects/<id>.ts (the file name must match the
 * effect id, which is how "Copy code" finds it) and add it here.
 */
export const EFFECTS: Effect[] = [
  parallax,
  constellation,
  dotGrid,
  watchingEyes,
  flashlight,
  ink,
  paint,
  ribbon,
  comet,
  trail,
  fireworks,
  repel,
];
