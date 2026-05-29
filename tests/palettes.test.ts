import { describe, it, expect } from 'vitest';
import { PALETTES, getPalette, samplePalette } from '../src/palettes/palettes';

describe('getPalette', () => {
  it('returns the requested palette', () => {
    expect(getPalette('neon').id).toBe('neon');
  });

  it('falls back to the first palette for unknown ids', () => {
    expect(getPalette('does-not-exist').id).toBe(PALETTES[0].id);
  });
});

describe('palette definitions', () => {
  it('every palette has a valid hex background and at least two stops', () => {
    for (const p of PALETTES) {
      expect(p.stops.length).toBeGreaterThanOrEqual(2);
      expect(p.background).toMatch(/^#[0-9a-fA-F]{6}$/);
      for (const s of p.stops) expect(s).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(p.intensity).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    const ids = PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('samplePalette', () => {
  const p = getPalette('iridescent');

  it('returns finite, non-negative channels across the ramp', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const c = samplePalette(p, t);
      for (const v of [c.r, c.g, c.b]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('wraps t outside [0,1)', () => {
    expect(samplePalette(p, 1.25)).toEqual(samplePalette(p, 0.25));
    expect(samplePalette(p, -0.75)).toEqual(samplePalette(p, 0.25));
  });

  it('scales output by palette intensity', () => {
    // Doubling intensity should double every sampled channel.
    const dim = samplePalette({ ...p, intensity: 0.1 }, 0.3);
    const bright = samplePalette({ ...p, intensity: 0.2 }, 0.3);
    expect(bright.r).toBeCloseTo(dim.r * 2, 6);
    expect(bright.g).toBeCloseTo(dim.g * 2, 6);
    expect(bright.b).toBeCloseTo(dim.b * 2, 6);
  });
});
