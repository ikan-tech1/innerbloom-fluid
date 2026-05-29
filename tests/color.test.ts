import { describe, it, expect } from 'vitest';
import { hexToRgb, hsvToRgb, mixRgb, scaleRgb } from '../src/lib/color';

describe('hexToRgb', () => {
  it('parses 6-digit hex with leading hash', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 1, g: 0, b: 0 });
  });

  it('parses 6-digit hex without hash', () => {
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 1, b: 0 });
  });

  it('expands 3-digit shorthand', () => {
    expect(hexToRgb('#00f')).toEqual({ r: 0, g: 0, b: 1 });
  });

  it('parses mid-range values correctly', () => {
    const c = hexToRgb('#808080');
    expect(c.r).toBeCloseTo(128 / 255, 5);
    expect(c.g).toBeCloseTo(128 / 255, 5);
  });

  it('throws on invalid input', () => {
    expect(() => hexToRgb('#xyz')).toThrow();
    expect(() => hexToRgb('12345')).toThrow();
    expect(() => hexToRgb('')).toThrow();
  });
});

describe('hsvToRgb', () => {
  it('returns white for zero saturation', () => {
    expect(hsvToRgb(0.5, 0, 1)).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('returns pure red at hue 0', () => {
    const c = hsvToRgb(0, 1, 1);
    expect(c.r).toBeCloseTo(1, 5);
    expect(c.g).toBeCloseTo(0, 5);
    expect(c.b).toBeCloseTo(0, 5);
  });

  it('wraps negative hue', () => {
    const a = hsvToRgb(-0.001, 1, 1);
    expect(a.r).toBeCloseTo(1, 2);
  });

  it('keeps all channels within [0,1]', () => {
    for (let h = 0; h < 1; h += 0.1) {
      const c = hsvToRgb(h, 1, 1);
      for (const v of [c.r, c.g, c.b]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('mixRgb / scaleRgb', () => {
  it('mixes endpoints', () => {
    const a = { r: 0, g: 0, b: 0 };
    const b = { r: 1, g: 1, b: 1 };
    expect(mixRgb(a, b, 0)).toEqual(a);
    expect(mixRgb(a, b, 1)).toEqual(b);
    expect(mixRgb(a, b, 0.5)).toEqual({ r: 0.5, g: 0.5, b: 0.5 });
  });

  it('scales channels', () => {
    expect(scaleRgb({ r: 0.5, g: 0.4, b: 0.2 }, 2)).toEqual({ r: 1, g: 0.8, b: 0.4 });
  });
});
