import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, makeConfig, QUALITY_PRESETS } from '../src/sim/config';

describe('makeConfig', () => {
  it('returns defaults when given no overrides', () => {
    expect(makeConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('applies overrides without mutating the default', () => {
    const cfg = makeConfig({ curl: 99, palette: 'neon' });
    expect(cfg.curl).toBe(99);
    expect(cfg.palette).toBe('neon');
    expect(DEFAULT_CONFIG.curl).not.toBe(99);
  });

  it('returns a fresh object each call', () => {
    expect(makeConfig()).not.toBe(makeConfig());
  });
});

describe('quality presets', () => {
  it('orders sim resolution from low to ultra', () => {
    expect(QUALITY_PRESETS.low.simResolution!).toBeLessThan(QUALITY_PRESETS.medium.simResolution!);
    expect(QUALITY_PRESETS.medium.simResolution!).toBeLessThan(QUALITY_PRESETS.high.simResolution!);
    expect(QUALITY_PRESETS.high.simResolution!).toBeLessThan(QUALITY_PRESETS.ultra.simResolution!);
  });

  it('merges cleanly into a full config', () => {
    const cfg = makeConfig(QUALITY_PRESETS.low);
    expect(cfg.simResolution).toBe(QUALITY_PRESETS.low.simResolution);
    expect(cfg.splatForce).toBe(DEFAULT_CONFIG.splatForce);
  });
});
