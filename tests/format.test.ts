import { describe, it, expect } from 'vitest';
import { selectFormats } from '../src/gl/format';
import type { GLCapabilities } from '../src/gl/context';

// Minimal stand-in for the GL constants selectFormats reads. Distinct numbers
// let us assert the correct enum was chosen for each precision path.
const GL = {
  HALF_FLOAT: 0x140b,
  FLOAT: 0x1406,
  RGBA16F: 0x881a,
  RGBA32F: 0x8814,
  RGBA: 0x1908,
  RG16F: 0x822f,
  RG32F: 0x8230,
  RG: 0x8227,
  R16F: 0x822d,
  R32F: 0x822e,
  RED: 0x1903,
  LINEAR: 0x2601,
  NEAREST: 0x2600,
} as unknown as WebGL2RenderingContext;

function caps(over: Partial<GLCapabilities> = {}): GLCapabilities {
  return {
    supportsFloat: true,
    supportsHalfFloat: true,
    supportsLinearFloat: true,
    maxTextureSize: 8192,
    ...over,
  };
}

describe('selectFormats', () => {
  it('prefers half-float when available', () => {
    const f = selectFormats(GL, caps());
    expect(f.halfFloat).toBe(true);
    expect(f.rgba.internalFormat).toBe(GL.RGBA16F);
    expect(f.rgba.type).toBe(GL.HALF_FLOAT);
    expect(f.rg.internalFormat).toBe(GL.RG16F);
    expect(f.r.internalFormat).toBe(GL.R16F);
  });

  it('falls back to full float when half-float is unavailable', () => {
    const f = selectFormats(GL, caps({ supportsHalfFloat: false }));
    expect(f.halfFloat).toBe(false);
    expect(f.rgba.internalFormat).toBe(GL.RGBA32F);
    expect(f.rgba.type).toBe(GL.FLOAT);
    expect(f.r.internalFormat).toBe(GL.R32F);
  });

  it('uses LINEAR filtering when float-linear is supported', () => {
    const f = selectFormats(GL, caps({ supportsLinearFloat: true }));
    expect(f.filtering).toBe(GL.LINEAR);
    expect(f.needsManualBilinear).toBe(false);
  });

  it('drops to NEAREST and flags manual bilinear without float-linear', () => {
    const f = selectFormats(GL, caps({ supportsLinearFloat: false }));
    expect(f.filtering).toBe(GL.NEAREST);
    expect(f.needsManualBilinear).toBe(true);
  });
});
