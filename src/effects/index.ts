import type { Effect } from '../engine/types';
import { trip } from './trip';
import { lava } from './lava';
import { skyTheme } from './sky';
import { smoke } from './smoke';
import { shootingStars } from './meteors';
import { magnet } from './magnet';
import { aurora } from './aurora';
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
import { fireflies } from './fireflies';
import { orbit } from './orbit';
import { ribbon } from './ribbon';
import { comet } from './comet';
import { trail } from './trail';
import { echo } from './echo';
import { soapBubbles } from './bubbles';
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
  skyTheme,
  trip,
  smoke,
  lava,
  aurora,
  shootingStars,
  warp,
  parallax,
  constellation,
  dotGrid,
  magnet,
  watchingEyes,
  flashlight,
  ink,
  paint,
  gravity,
  ribbon,
  boids,
  fireflies,
  orbit,
  comet,
  trail,
  echo,
  soapBubbles,
  confetti,
  fireworks,
  shockwave,
  customCursor,
];
