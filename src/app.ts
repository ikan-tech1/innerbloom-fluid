// Application orchestrator: owns the GL context, simulation, input, idle motion,
// optional audio, and the render loop. The UI (toolbar + Tweakpane) drives it
// through this small, explicit surface.

import { createGLContext, WebGLUnsupportedError, type GLContext } from './gl/context';
import { FluidSimulation } from './sim/FluidSimulation';
import { makeConfig, QUALITY_PRESETS, type QualityLevel, type SimConfig } from './sim/config';
import { PaletteSource } from './sim/splat';
import { getPalette, samplePalette } from './palettes/palettes';
import { PointerInput } from './input/pointer';
import { IdleMotion } from './input/idle';
import type { AudioReactive } from './audio/audioReactive';

const MAX_DPR = 2;
const MAX_FRAME_DT = 1 / 30; // clamp long frames so the sim never explodes

function detectQuality(): QualityLevel {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  if (mobile && (cores <= 4 || mem <= 3)) return 'low';
  if (mobile) return 'medium';
  if (cores >= 8 && mem >= 8) return 'ultra';
  return 'high';
}

export class App {
  readonly ctx: GLContext;
  readonly sim: FluidSimulation;
  config: SimConfig;

  private readonly canvas: HTMLCanvasElement;
  private readonly paletteSource: PaletteSource;
  private readonly pointer: PointerInput;
  private readonly idle: IdleMotion;
  private audio: AudioReactive | null = null;

  private readonly reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private running = false;
  private paused = false;
  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private captureRequested = false;

  // FPS watchdog: drop quality if we sustain slow frames.
  private slowFrames = 0;
  private downgraded = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = createGLContext(canvas);

    const quality = detectQuality();
    this.config = makeConfig(QUALITY_PRESETS[quality]);
    this.applyReducedMotion();

    this.sim = new FluidSimulation(this.ctx, this.config);
    this.paletteSource = new PaletteSource(getPalette(this.config.palette));

    this.pointer = new PointerInput(canvas, this.sim, this.paletteSource, {
      getForce: () => this.config.splatForce,
      onActivity: () => this.idle.notifyActivity(this.elapsed),
    });
    this.idle = new IdleMotion(this.sim, this.paletteSource, () => this.config.splatForce);
    this.idle.setEnabled(this.config.idle);

    this.reducedMotionQuery.addEventListener('change', () => {
      this.applyReducedMotion();
      this.idle.setEnabled(this.config.idle);
    });

    this.resize();
    window.addEventListener('resize', this.resize);
    document.body.style.background = this.sim.backgroundHex();
  }

  // ---- Loop -----------------------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.seedIntro();
    this.rafId = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.rafId = requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.lastTime) / 1000, MAX_FRAME_DT);
    this.lastTime = now;
    this.elapsed = now;

    if (!this.paused) {
      if (this.audio?.active) this.audio.update(now);
      if (!this.pointer.active) this.idle.update(now, dt);
      this.sim.step(dt);
      this.watchdog(dt);
    }
    this.sim.render(now * 0.001);

    if (this.captureRequested) {
      this.captureRequested = false;
      this.downloadCanvas();
    }
  };

  private watchdog(dt: number): void {
    if (this.downgraded || !this.config.respectReducedMotion) return;
    if (dt > 1 / 45) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 90) {
      this.downgraded = true;
      this.setConfig({
        simResolution: Math.max(96, Math.round(this.config.simResolution * 0.66)),
        dyeResolution: Math.max(384, Math.round(this.config.dyeResolution * 0.66)),
        sunrays: false,
      });
    }
  }

  // ---- Public controls ------------------------------------------------------

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  setPalette(id: string): void {
    this.config.palette = id;
    this.paletteSource.setPalette(getPalette(id));
    document.body.style.background = this.sim.backgroundHex();
    this.sim.updateConfig(this.config);
  }

  /** Merge config changes from the control panel and apply side effects. */
  setConfig(partial: Partial<SimConfig>): void {
    this.config = { ...this.config, ...partial };
    this.idle.setEnabled(this.config.idle);
    this.sim.updateConfig(this.config);
    if (partial.palette) this.setPalette(partial.palette);
  }

  reset(): void {
    this.sim.reset();
    this.seedIntro();
  }

  requestScreenshot(): void {
    this.captureRequested = true;
  }

  async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }

  async enableAudioMic(): Promise<void> {
    const audio = await this.ensureAudio();
    await audio.startMic();
    this.config.audioReactive = true;
  }

  async enableAudioFile(file: File): Promise<void> {
    const audio = await this.ensureAudio();
    await audio.startFile(file);
    this.config.audioReactive = true;
  }

  disableAudio(): void {
    this.audio?.stop();
    this.config.audioReactive = false;
  }

  private async ensureAudio(): Promise<AudioReactive> {
    if (!this.audio) {
      const { AudioReactive } = await import('./audio/audioReactive');
      this.audio = new AudioReactive(this.sim, this.paletteSource, () => this.config.splatForce);
    }
    return this.audio;
  }

  // ---- Internals ------------------------------------------------------------

  private applyReducedMotion(): void {
    if (this.config.respectReducedMotion && this.reducedMotionQuery.matches) {
      this.config.idle = false;
      this.config.grain = 0;
    }
  }

  private readonly resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.sim.resize();
  };

  /** Paint an inviting opening burst so the canvas is alive on load. */
  private seedIntro(): void {
    const palette = getPalette(this.config.palette);
    const force = this.config.splatForce * 0.6;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const x = 0.15 + 0.7 * (i / (n - 1));
      const y = 0.5 + 0.18 * Math.sin(i * 1.7);
      const color = samplePalette(palette, i / n);
      const angle = i * 2.4;
      this.sim.splat(x, y, Math.cos(angle) * force, Math.sin(angle) * force, color);
    }
  }

  private downloadCanvas(): void {
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `innerbloom-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resize);
    this.pointer.dispose();
    this.audio?.stop();
    this.sim.dispose();
  }
}

export { WebGLUnsupportedError };
