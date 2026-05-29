import { describe, it, expect } from 'vitest';
import { createCurlField } from '../src/lib/simplex';

describe('createCurlField', () => {
  it('is deterministic for a given seed', () => {
    const a = createCurlField('seed-x');
    const b = createCurlField('seed-x');
    expect(a.noise(1.2, 3.4, 5.6)).toBe(b.noise(1.2, 3.4, 5.6));
    expect(a.curl(0.3, 0.7, 1.1)).toEqual(b.curl(0.3, 0.7, 1.1));
  });

  it('produces different fields for different seeds', () => {
    const a = createCurlField('alpha');
    const b = createCurlField('beta');
    // A single sample can coincide by chance; compare across many points and
    // require that the fields differ somewhere.
    let differs = false;
    for (let i = 0; i < 32 && !differs; i++) {
      if (a.noise(i * 0.31, i * 0.57, i * 0.19) !== b.noise(i * 0.31, i * 0.57, i * 0.19)) {
        differs = true;
      }
    }
    expect(differs).toBe(true);
  });

  it('accepts numeric seeds', () => {
    const a = createCurlField(42);
    const b = createCurlField(42);
    expect(a.noise(0.1, 0.2, 0.3)).toBe(b.noise(0.1, 0.2, 0.3));
  });

  it('returns noise within [-1, 1]', () => {
    const f = createCurlField('range');
    for (let i = 0; i < 50; i++) {
      const n = f.noise(i * 0.37, i * 0.91, i * 0.13);
      expect(n).toBeGreaterThanOrEqual(-1);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('returns finite curl vectors', () => {
    const f = createCurlField('curl');
    for (let i = 0; i < 25; i++) {
      const c = f.curl(i * 0.2, i * 0.5, i * 0.05);
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
    }
  });
});
