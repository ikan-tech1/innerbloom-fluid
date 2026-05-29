// Splat data model + color sourcing. A "splat" injects velocity and dye into
// the fluid at a point — the shared primitive behind pointer, idle, and audio input.

import { samplePalette, type Palette } from '../palettes/palettes';
import type { RGB } from '../lib/color';

export interface Splat {
  /** Center in normalized [0,1] coordinates (origin bottom-left, matching GL UV). */
  x: number;
  y: number;
  /** Velocity delta to inject. */
  dx: number;
  dy: number;
  /** Dye color. */
  color: RGB;
}

/**
 * Walks the palette ramp over time so successive drags bleed through a coherent
 * range of hues rather than jumping randomly. `phase` advances per splat.
 */
export class PaletteSource {
  private phase = Math.random();

  constructor(private palette: Palette) {}

  setPalette(palette: Palette): void {
    this.palette = palette;
  }

  /** Next color along the ramp; `step` controls how fast hues drift. */
  next(step = 0.0035): RGB {
    this.phase = (this.phase + step) % 1;
    return samplePalette(this.palette, this.phase);
  }

  /** A color at an explicit position (used for multitouch so fingers differ). */
  at(t: number): RGB {
    return samplePalette(this.palette, t);
  }
}
