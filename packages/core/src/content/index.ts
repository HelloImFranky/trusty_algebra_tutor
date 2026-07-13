import { unit1, unit2, unit3 } from './units1to3.js';
import { unit4, unit5, unit6 } from './units4to6.js';
import { unit7, unit8, unit9 } from './units7to9.js';
import type { UnitSeed } from './types.js';

export const curriculum: UnitSeed[] = [
  unit1,
  unit2,
  unit3,
  unit4,
  unit5,
  unit6,
  unit7,
  unit8,
  unit9,
];

export { referenceSheet } from './referenceSheet.js';
export * from './regents.js';
export * from './regentsRandom.js';
export * from './types.js';
