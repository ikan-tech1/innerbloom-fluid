// Curated color palettes. Splats sample colors by walking a palette's stops,
// so each drag bleeds through a coherent, designed range rather than random hues.

import { hexToRgb, mixRgb, scaleRgb, type RGB } from '../lib/color';

export interface Palette {
  id: string;
  name: string;
  /** Background tint (kept near-black for the macro-liquid look). */
  background: string;
  /** Ordered color stops the dye walks through. */
  stops: string[];
  /** Per-palette dye brightness so neon vs. ink read at similar energy. */
  intensity: number;
}

export const PALETTES: Palette[] = [
  {
    id: 'iridescent',
    name: 'Iridescent',
    background: '#05050a',
    stops: ['#1b2a6b', '#3a3df0', '#7a3ff0', '#c13ad6', '#f0567a', '#f0a823'],
    intensity: 0.16,
  },
  {
    id: 'neon',
    name: 'Neon',
    background: '#04030a',
    stops: ['#00e5ff', '#2979ff', '#7c4dff', '#ff4dd2', '#ff5252', '#ffd740'],
    intensity: 0.2,
  },
  {
    id: 'ink',
    name: 'Monochrome Ink',
    background: '#070707',
    stops: ['#1a2b3c', '#33566f', '#6f93ad', '#a9c7da', '#e6f0f6'],
    intensity: 0.15,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    background: '#0a0506',
    stops: ['#2b1055', '#7b2ff7', '#e2467a', '#ff7e5f', '#ffb56b', '#ffe29a'],
    intensity: 0.17,
  },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/**
 * Sample a color along the palette ramp at position t in [0,1), interpolating
 * between adjacent stops. Scaled by the palette intensity so dye stays in a
 * sensible HDR range for bloom.
 */
export function samplePalette(palette: Palette, t: number): RGB {
  const stops = palette.stops;
  const n = stops.length;
  if (n === 1) return scaleRgb(hexToRgb(stops[0]), palette.intensity);

  const x = ((t % 1) + 1) % 1; // wrap into [0,1)
  const scaled = x * (n - 1);
  const i = Math.floor(scaled);
  const frac = scaled - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[Math.min(i + 1, n - 1)]);
  return scaleRgb(mixRgb(a, b, frac), palette.intensity);
}
