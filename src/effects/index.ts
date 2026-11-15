import type { Effect } from '../engine/types';
import { trail } from './trail';
import { paint } from './paint';
import { fireworks } from './fireworks';

/**
 * Every effect, in draw order (earlier draws underneath).
 * To add an effect: write src/effects/your-effect.ts and add it here.
 */
export const EFFECTS: Effect[] = [trail, paint, fireworks];
