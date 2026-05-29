// Idle auto-motion: when no one is interacting, a slow curl-noise field drifts
// pointers across the canvas so the fluid keeps breathing on its own — the
// hands-off "Innerbloom" ambience. Yields instantly to real input.

import type { FluidSimulation } from '../sim/FluidSimulation';
import type { PaletteSource } from '../sim/splat';
import { createCurlField, type CurlField } from '../lib/simplex';

const IDLE_DELAY_MS = 2600; // quiet time before ambient motion fades in
const FADE_IN_MS = 2200;
const NUM_DRIFTERS = 3;
const SPAWN_INTERVAL_MS = 120;

interface Drifter {
  x: number;
  y: number;
  seed: number;
}

export class IdleMotion {
  private readonly field: CurlField;
  private readonly drifters: Drifter[] = [];
  private lastActivity = 0;
  private lastSpawn = 0;
  private enabled = true;

  constructor(
    private readonly sim: FluidSimulation,
    private readonly palette: PaletteSource,
    private readonly getForce: () => number,
  ) {
    this.field = createCurlField('innerbloom');
    for (let i = 0; i < NUM_DRIFTERS; i++) {
      this.drifters.push({ x: 0.3 + 0.2 * i, y: 0.5, seed: i * 13.7 });
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  notifyActivity(now: number): void {
    this.lastActivity = now;
  }

  /** Returns how strongly ambient motion is currently expressed (0..1). */
  update(now: number, dtSeconds: number): number {
    if (!this.enabled) return 0;
    const quietFor = now - this.lastActivity;
    if (quietFor < IDLE_DELAY_MS) return 0;

    const fade = Math.min(1, (quietFor - IDLE_DELAY_MS) / FADE_IN_MS);
    if (now - this.lastSpawn < SPAWN_INTERVAL_MS) return fade;
    this.lastSpawn = now;

    const t = now * 0.00006;
    const force = this.getForce() * 0.16 * fade;

    for (const d of this.drifters) {
      const c = this.field.curl(d.x * 2.2 + d.seed, d.y * 2.2, t);
      // Advance the drifter along the curl field; wrap at edges.
      d.x = (d.x + c.x * 0.12 * dtSeconds + 1) % 1;
      d.y = (d.y + c.y * 0.12 * dtSeconds + 1) % 1;
      const color = this.palette.next(0.0009);
      this.sim.splat(d.x, d.y, c.x * force, c.y * force, color);
    }
    return fade;
  }
}
