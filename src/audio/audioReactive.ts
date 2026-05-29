// Audio reactivity: drives the fluid from microphone or an audio file. Bass
// energy triggers beat "blooms"; overall level continuously nudges momentum so
// the liquid pulses with the music. Loaded lazily so the core bundle stays lean.

import type { FluidSimulation } from '../sim/FluidSimulation';
import type { PaletteSource } from '../sim/splat';

export interface AudioBands {
  bass: number;
  mid: number;
  treble: number;
  level: number;
  beat: boolean;
}

const FFT_SIZE = 1024;
const BEAT_COOLDOWN_MS = 220;
const BEAT_SENSITIVITY = 1.35;

function average(data: Uint8Array<ArrayBuffer>, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += data[i];
  return sum / Math.max(1, to - from) / 255;
}

export class AudioReactive {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private source: AudioNode | null = null;
  private mediaEl: HTMLAudioElement | null = null;
  private stream: MediaStream | null = null;
  private bassAvg = 0;
  private lastBeat = 0;
  private _active = false;

  constructor(
    private readonly sim: FluidSimulation,
    private readonly palette: PaletteSource,
    private readonly getForce: () => number,
  ) {}

  get active(): boolean {
    return this._active;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      this.analyser = analyser;
      this.freq = new Uint8Array(analyser.frequencyBinCount);
    }
    return this.ctx;
  }

  async startMic(): Promise<void> {
    const ctx = this.ensureContext();
    await ctx.resume();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.disconnectSource();
    const src = ctx.createMediaStreamSource(this.stream);
    src.connect(this.analyser!); // analyser only — never to destination (feedback)
    this.source = src;
    this._active = true;
  }

  async startFile(file: File): Promise<void> {
    const ctx = this.ensureContext();
    await ctx.resume();
    this.disconnectSource();
    const el = new Audio();
    el.src = URL.createObjectURL(file);
    el.loop = true;
    el.crossOrigin = 'anonymous';
    await el.play();
    const src = ctx.createMediaElementSource(el);
    src.connect(this.analyser!);
    this.analyser!.connect(ctx.destination); // play file audibly
    this.source = src;
    this.mediaEl = el;
    this._active = true;
  }

  update(now: number): AudioBands {
    const idle: AudioBands = { bass: 0, mid: 0, treble: 0, level: 0, beat: false };
    if (!this._active || !this.analyser) return idle;

    this.analyser.getByteFrequencyData(this.freq);
    const n = this.freq.length;
    const bass = average(this.freq, 0, Math.floor(n * 0.08));
    const mid = average(this.freq, Math.floor(n * 0.08), Math.floor(n * 0.4));
    const treble = average(this.freq, Math.floor(n * 0.4), n);
    const level = (bass + mid + treble) / 3;

    // Adaptive beat detection on the bass band.
    this.bassAvg = this.bassAvg * 0.92 + bass * 0.08;
    let beat = false;
    if (bass > this.bassAvg * BEAT_SENSITIVITY && bass > 0.18 && now - this.lastBeat > BEAT_COOLDOWN_MS) {
      beat = true;
      this.lastBeat = now;
      this.emitBeat(bass);
    }
    // Continuous shimmer from mids/treble.
    if (level > 0.04) this.emitShimmer(mid, treble);

    return { bass, mid, treble, level, beat };
  }

  private emitBeat(bass: number): void {
    const force = this.getForce() * (0.4 + bass);
    const bursts = 2 + Math.floor(bass * 3);
    for (let i = 0; i < bursts; i++) {
      const x = Math.random();
      const y = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const color = this.palette.next(0.05);
      this.sim.splat(x, y, Math.cos(angle) * force, Math.sin(angle) * force, color);
    }
  }

  private emitShimmer(mid: number, treble: number): void {
    const force = this.getForce() * 0.08 * (mid + treble);
    const x = Math.random();
    const y = Math.random();
    const angle = Math.random() * Math.PI * 2;
    const color = this.palette.next(0.002);
    this.sim.splat(x, y, Math.cos(angle) * force, Math.sin(angle) * force, color);
  }

  private disconnectSource(): void {
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        /* already disconnected */
      }
      this.source = null;
    }
  }

  stop(): void {
    this.disconnectSource();
    if (this.mediaEl) {
      this.mediaEl.pause();
      if (this.mediaEl.src.startsWith('blob:')) URL.revokeObjectURL(this.mediaEl.src);
      this.mediaEl = null;
    }
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    this._active = false;
  }
}
