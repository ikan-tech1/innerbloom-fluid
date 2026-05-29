// Unified pointer input (mouse + pen + multitouch) via Pointer Events.
// Each active pointer drags color and momentum into the fluid.

import type { FluidSimulation } from '../sim/FluidSimulation';
import type { PaletteSource } from '../sim/splat';
import type { RGB } from '../lib/color';

interface TrackedPointer {
  x: number;
  y: number;
  color: RGB;
  moved: boolean;
}

export interface PointerInputOptions {
  getForce: () => number;
  /** Called whenever the user actively interacts (used to suppress idle motion). */
  onActivity: () => void;
}

export class PointerInput {
  private readonly pointers = new Map<number, TrackedPointer>();
  private readonly onDown: (e: PointerEvent) => void;
  private readonly onMove: (e: PointerEvent) => void;
  private readonly onUp: (e: PointerEvent) => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly sim: FluidSimulation,
    private readonly palette: PaletteSource,
    private readonly opts: PointerInputOptions,
  ) {
    this.onDown = (e) => this.handleDown(e);
    this.onMove = (e) => this.handleMove(e);
    this.onUp = (e) => this.handleUp(e);

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  get active(): boolean {
    return this.pointers.size > 0;
  }

  private toUv(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      // Flip Y: DOM origin is top-left, GL UV origin is bottom-left.
      y: 1 - (e.clientY - rect.top) / rect.height,
    };
  }

  private aspectCorrect(dx: number, dy: number): { dx: number; dy: number } {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    let cdx = dx;
    let cdy = dy;
    if (aspect < 1) cdx *= aspect;
    else cdy /= aspect;
    return { dx: cdx, dy: cdy };
  }

  private handleDown(e: PointerEvent): void {
    const { x, y } = this.toUv(e);
    const color = this.palette.next(0.13); // jump the ramp on each new touch
    this.pointers.set(e.pointerId, { x, y, color, moved: false });
    this.opts.onActivity();
    // A tap with no drag still blooms a gentle puff of color.
    this.sim.splat(x, y, 0, 0, color);
  }

  private handleMove(e: PointerEvent): void {
    const tracked = this.pointers.get(e.pointerId);
    if (!tracked) return;
    const { x, y } = this.toUv(e);
    const raw = this.aspectCorrect(x - tracked.x, y - tracked.y);
    const force = this.opts.getForce();
    tracked.x = x;
    tracked.y = y;
    tracked.moved = true;
    this.opts.onActivity();
    this.sim.splat(x, y, raw.dx * force, raw.dy * force, tracked.color);
  }

  private handleUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.pointers.clear();
  }
}
