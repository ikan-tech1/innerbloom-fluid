// Picks texture storage formats based on detected GPU capabilities.

import type { GLCapabilities } from './context';

export interface TexFormat {
  internalFormat: number;
  format: number;
  type: number;
}

export interface SimFormats {
  /** RGBA color/dye target. */
  rgba: TexFormat;
  /** Two-channel velocity target. */
  rg: TexFormat;
  /** Single-channel scalar fields (pressure, divergence, curl). */
  r: TexFormat;
  /** Filtering to use for float sampling: LINEAR if supported else NEAREST. */
  filtering: number;
  /** True when LINEAR float filtering is unavailable and shaders must emulate it. */
  needsManualBilinear: boolean;
  /** True when we fell back to half-float precision. */
  halfFloat: boolean;
}

/**
 * Prefer half-float (RGBA16F) — it is plenty precise for a fluid sim, uses half
 * the bandwidth of full float, and is the most broadly renderable format. Fall
 * back to full float only when half-float render targets are unavailable.
 */
export function selectFormats(gl: WebGL2RenderingContext, caps: GLCapabilities): SimFormats {
  const useHalf = caps.supportsHalfFloat;
  const type = useHalf ? gl.HALF_FLOAT : gl.FLOAT;

  const rgba: TexFormat = {
    internalFormat: useHalf ? gl.RGBA16F : gl.RGBA32F,
    format: gl.RGBA,
    type,
  };
  const rg: TexFormat = {
    internalFormat: useHalf ? gl.RG16F : gl.RG32F,
    format: gl.RG,
    type,
  };
  const r: TexFormat = {
    internalFormat: useHalf ? gl.R16F : gl.R32F,
    format: gl.RED,
    type,
  };

  return {
    rgba,
    rg,
    r,
    filtering: caps.supportsLinearFloat ? gl.LINEAR : gl.NEAREST,
    needsManualBilinear: !caps.supportsLinearFloat,
    halfFloat: useHalf,
  };
}
