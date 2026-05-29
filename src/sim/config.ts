// Simulation + render configuration. Defaults are tuned toward the slow,
// viscous, marbling "Innerbloom" macro-liquid look rather than fast neon.

export interface SimConfig {
  /** Velocity grid resolution (longest axis). Lower = smoother, cheaper. */
  simResolution: number;
  /** Dye/color grid resolution (longest axis). Higher = crisper color detail. */
  dyeResolution: number;
  /** Jacobi iterations for the pressure solve. */
  pressureIterations: number;
  /** Pressure retained between frames (0..1). */
  pressure: number;
  /** Velocity dissipation per second (higher = thicker/slower fluid). */
  velocityDissipation: number;
  /** Dye dissipation per second (low = acrylic-pour persistence). */
  densityDissipation: number;
  /** Vorticity confinement strength (organic swirl detail). */
  curl: number;
  /** Splat radius as a fraction of the screen. */
  splatRadius: number;
  /** Force multiplier applied to pointer-driven velocity splats. */
  splatForce: number;
  /** Render exposure. */
  exposure: number;
  bloom: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  bloomSoftKnee: number;
  sunrays: boolean;
  sunraysWeight: number;
  shading: boolean;
  vignette: number;
  grain: number;
  /** Idle auto-motion when the pointer is inactive. */
  idle: boolean;
  /** Pulse the fluid in response to audio (off until enabled by the user). */
  audioReactive: boolean;
  /** Respect prefers-reduced-motion (disables idle + softens force). */
  respectReducedMotion: boolean;
  /** Active palette id (see palettes.ts). */
  palette: string;
}

export const DEFAULT_CONFIG: SimConfig = {
  simResolution: 192,
  dyeResolution: 1024,
  pressureIterations: 28,
  pressure: 0.8,
  velocityDissipation: 1.4,
  densityDissipation: 0.6,
  curl: 24,
  splatRadius: 0.28,
  splatForce: 5200,
  exposure: 1.05,
  bloom: true,
  bloomIntensity: 0.7,
  bloomThreshold: 0.5,
  bloomSoftKnee: 0.7,
  sunrays: true,
  sunraysWeight: 0.8,
  shading: true,
  vignette: 0.5,
  grain: 0.03,
  idle: true,
  audioReactive: false,
  respectReducedMotion: true,
  palette: 'iridescent',
};

export function makeConfig(overrides: Partial<SimConfig> = {}): SimConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

/** Quality presets for device-appropriate defaults. */
export const QUALITY_PRESETS = {
  low: { simResolution: 96, dyeResolution: 384, pressureIterations: 18, bloom: true, sunrays: false },
  medium: { simResolution: 128, dyeResolution: 640, pressureIterations: 22, bloom: true, sunrays: true },
  high: { simResolution: 192, dyeResolution: 1024, pressureIterations: 28, bloom: true, sunrays: true },
  ultra: { simResolution: 256, dyeResolution: 1440, pressureIterations: 32, bloom: true, sunrays: true },
} as const satisfies Record<string, Partial<SimConfig>>;

export type QualityLevel = keyof typeof QUALITY_PRESETS;
