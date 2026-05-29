// Thin wrapper over simplex-noise providing a seeded 3D field plus a 2D curl
// helper used by the idle auto-motion to generate divergence-free drift.

import { createNoise3D } from 'simplex-noise';

export interface CurlField {
  /** Sample the curl of the noise field at (x, y) for time t. Returns a unit-ish 2D vector. */
  curl(x: number, y: number, t: number): { x: number; y: number };
  /** Raw 3D noise sample in [-1, 1]. */
  noise(x: number, y: number, z: number): number;
}

/**
 * Mulberry32 PRNG so a string/number seed yields a deterministic field —
 * important for reproducible tests and stable idle motion across reloads.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createCurlField(seed: string | number = 'innerbloom'): CurlField {
  const noise3D = createNoise3D(mulberry32(hashSeed(seed)));
  const eps = 1e-3;

  return {
    noise: (x, y, z) => noise3D(x, y, z),
    curl(x, y, t) {
      // Curl of a 2D potential field: rotate the gradient 90°.
      const n1 = noise3D(x, y + eps, t);
      const n2 = noise3D(x, y - eps, t);
      const n3 = noise3D(x + eps, y, t);
      const n4 = noise3D(x - eps, y, t);
      const dx = (n1 - n2) / (2 * eps);
      const dy = (n3 - n4) / (2 * eps);
      return { x: dx, y: -dy };
    },
  };
}
