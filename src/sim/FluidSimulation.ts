// The fluid solver: owns every GPU field and runs the Navier-Stokes pass
// pipeline each frame, then composites dye → bloom → sunrays → screen.

import type { GLContext } from '../gl/context';
import { Program, withDefines } from '../gl/program';
import { FullscreenQuad } from '../gl/quad';
import { createFBO, DoubleFBO, type FBO } from '../gl/framebuffer';
import { selectFormats, type SimFormats } from '../gl/format';
import { getPalette } from '../palettes/palettes';
import type { SimConfig } from './config';
import type { Splat } from './splat';

import baseVert from '../shaders/base.vert?raw';
import copyFrag from '../shaders/copy.frag?raw';
import advectionFrag from '../shaders/advection.frag?raw';
import divergenceFrag from '../shaders/divergence.frag?raw';
import curlFrag from '../shaders/curl.frag?raw';
import vorticityFrag from '../shaders/vorticity.frag?raw';
import pressureFrag from '../shaders/pressure.frag?raw';
import gradientSubtractFrag from '../shaders/gradientSubtract.frag?raw';
import clearFrag from '../shaders/clear.frag?raw';
import splatFrag from '../shaders/splat.frag?raw';
import displayFrag from '../shaders/display.frag?raw';
import bloomPrefilterFrag from '../shaders/bloomPrefilter.frag?raw';
import bloomBlurFrag from '../shaders/bloomBlur.frag?raw';
import bloomFinalFrag from '../shaders/bloomFinal.frag?raw';
import sunraysMaskFrag from '../shaders/sunraysMask.frag?raw';
import sunraysFrag from '../shaders/sunrays.frag?raw';

const BLOOM_MIPS = 7;
const BLOOM_BASE_RESOLUTION = 256;
const SUNRAYS_RESOLUTION = 196;

interface Resolution {
  width: number;
  height: number;
}

export class FluidSimulation {
  private readonly gl: WebGL2RenderingContext;
  private readonly fmt: SimFormats;
  private readonly quad: FullscreenQuad;

  // Programs
  private readonly copy: Program;
  private readonly advection: Program;
  private readonly divergence: Program;
  private readonly curl: Program;
  private readonly vorticity: Program;
  private readonly pressure: Program;
  private readonly gradientSubtract: Program;
  private readonly clear: Program;
  private readonly splatProgram: Program;
  private readonly bloomPrefilter: Program;
  private readonly bloomBlur: Program;
  private readonly bloomFinal: Program;
  private readonly sunraysMask: Program;
  private readonly sunraysProgram: Program;
  private readonly displayCache = new Map<string, Program>();

  // Fields
  private velocity!: DoubleFBO;
  private dye!: DoubleFBO;
  private pressureField!: DoubleFBO;
  private divergenceField!: FBO;
  private curlField!: FBO;
  private bloomTarget!: FBO;
  private bloomMips: FBO[] = [];
  private sunraysTarget!: FBO;
  private sunraysTemp!: FBO;
  private dither!: WebGLTexture;
  private readonly ditherSize = 256;

  private readonly pending: Splat[] = [];

  constructor(
    ctx: GLContext,
    public config: SimConfig,
  ) {
    this.gl = ctx.gl;
    this.fmt = selectFormats(this.gl, ctx.caps);
    this.quad = new FullscreenQuad(this.gl);

    const advectionDefines = this.fmt.needsManualBilinear ? ['MANUAL_FILTERING'] : [];

    this.copy = new Program(this.gl, baseVert, copyFrag, 'copy');
    this.advection = new Program(this.gl, baseVert, withDefines(advectionFrag, advectionDefines), 'advection');
    this.divergence = new Program(this.gl, baseVert, divergenceFrag, 'divergence');
    this.curl = new Program(this.gl, baseVert, curlFrag, 'curl');
    this.vorticity = new Program(this.gl, baseVert, vorticityFrag, 'vorticity');
    this.pressure = new Program(this.gl, baseVert, pressureFrag, 'pressure');
    this.gradientSubtract = new Program(this.gl, baseVert, gradientSubtractFrag, 'gradientSubtract');
    this.clear = new Program(this.gl, baseVert, clearFrag, 'clear');
    this.splatProgram = new Program(this.gl, baseVert, splatFrag, 'splat');
    this.bloomPrefilter = new Program(this.gl, baseVert, bloomPrefilterFrag, 'bloomPrefilter');
    this.bloomBlur = new Program(this.gl, baseVert, bloomBlurFrag, 'bloomBlur');
    this.bloomFinal = new Program(this.gl, baseVert, bloomFinalFrag, 'bloomFinal');
    this.sunraysMask = new Program(this.gl, baseVert, sunraysMaskFrag, 'sunraysMask');
    this.sunraysProgram = new Program(this.gl, baseVert, sunraysFrag, 'sunrays');

    this.gl.disable(this.gl.BLEND);
    this.createDither();
    this.initFramebuffers();
  }

  // ---- Resource setup -------------------------------------------------------

  private resolution(target: number): Resolution {
    const gl = this.gl;
    let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (!isFinite(aspect) || aspect === 0) aspect = 1;
    if (aspect < 1) aspect = 1 / aspect;
    const min = Math.round(target);
    const max = Math.round(target * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight
      ? { width: max, height: min }
      : { width: min, height: max };
  }

  private createDither(): void {
    const gl = this.gl;
    const size = this.ditherSize;
    const data = new Uint8Array(size * size);
    // Deterministic-enough blue-ish noise via a hash; avoids shipping an asset.
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 256) | 0;
    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to allocate dither texture');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    this.dither = tex;
  }

  /** (Re)create all field framebuffers — called on init and whenever resolution changes. */
  initFramebuffers(): void {
    const gl = this.gl;
    const sim = this.resolution(this.config.simResolution);
    const dye = this.resolution(this.config.dyeResolution);
    const f = this.fmt;

    this.velocity?.dispose();
    this.dye?.dispose();
    this.pressureField?.dispose();
    this.divergenceField?.dispose();
    this.curlField?.dispose();

    this.velocity = new DoubleFBO(gl, sim.width, sim.height, f.rg, f.filtering);
    this.dye = new DoubleFBO(gl, dye.width, dye.height, f.rgba, f.filtering);
    this.pressureField = new DoubleFBO(gl, sim.width, sim.height, f.r, gl.NEAREST);
    this.divergenceField = createFBO(gl, sim.width, sim.height, f.r, gl.NEAREST);
    this.curlField = createFBO(gl, sim.width, sim.height, f.r, gl.NEAREST);

    this.initPostFramebuffers();
  }

  private initPostFramebuffers(): void {
    const gl = this.gl;
    const f = this.fmt;

    this.bloomTarget?.dispose();
    for (const m of this.bloomMips) m.dispose();
    this.bloomMips = [];
    this.sunraysTarget?.dispose();
    this.sunraysTemp?.dispose();

    const base = this.resolution(BLOOM_BASE_RESOLUTION);
    this.bloomTarget = createFBO(gl, base.width, base.height, f.rgba, f.filtering);
    for (let i = 0; i < BLOOM_MIPS; i++) {
      const w = base.width >> (i + 1);
      const h = base.height >> (i + 1);
      if (w < 2 || h < 2) break;
      this.bloomMips.push(createFBO(gl, w, h, f.rgba, f.filtering));
    }

    const sun = this.resolution(SUNRAYS_RESOLUTION);
    this.sunraysTarget = createFBO(gl, sun.width, sun.height, f.r, f.filtering);
    this.sunraysTemp = createFBO(gl, sun.width, sun.height, f.r, f.filtering);
  }

  // ---- Drawing helpers ------------------------------------------------------

  private blit(target: FBO | null): void {
    const gl = this.gl;
    if (target) {
      target.bind();
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    this.quad.draw();
  }

  /** Sets the shared uTexel uniform (used by neighbour taps in the vertex shader). */
  private setTexel(p: Program, fbo: FBO): void {
    p.uniform2f('uTexel', fbo.texelX, fbo.texelY);
  }

  // ---- Public API -----------------------------------------------------------

  queueSplat(splat: Splat): void {
    this.pending.push(splat);
  }

  /** Convenience for pointer/idle input. Coordinates are normalized [0,1] UV. */
  splat(x: number, y: number, dx: number, dy: number, color: { r: number; g: number; b: number }): void {
    this.pending.push({ x, y, dx, dy, color });
  }

  private aspect(): number {
    return this.gl.drawingBufferWidth / Math.max(1, this.gl.drawingBufferHeight);
  }

  private applySplat(s: Splat): void {
    const gl = this.gl;
    const radius = Math.max(this.config.splatRadius / 100, 1e-4);

    this.splatProgram.bind();
    this.splatProgram.texture('uTarget', this.velocity.read.texture, 0);
    this.splatProgram.uniform1f('uAspect', this.aspect());
    this.splatProgram.uniform2f('uPoint', s.x, s.y);
    this.splatProgram.uniform3f('uColor', s.dx, s.dy, 0);
    this.splatProgram.uniform1f('uRadius', radius);
    this.blit(this.velocity.write);
    this.velocity.swap();

    this.splatProgram.texture('uTarget', this.dye.read.texture, 0);
    this.splatProgram.uniform3f('uColor', s.color.r, s.color.g, s.color.b);
    this.blit(this.dye.write);
    this.dye.swap();
    gl.disable(gl.BLEND);
  }

  step(dt: number): void {
    const gl = this.gl;
    gl.disable(gl.BLEND);

    // Inject queued splats first so they participate in this frame's advection.
    for (const s of this.pending) this.applySplat(s);
    this.pending.length = 0;

    const velTexel = this.velocity.read;

    // Curl.
    this.curl.bind();
    this.setTexel(this.curl, velTexel);
    this.curl.texture('uVelocity', this.velocity.read.texture, 0);
    this.blit(this.curlField);

    // Vorticity confinement.
    this.vorticity.bind();
    this.setTexel(this.vorticity, velTexel);
    this.vorticity.texture('uVelocity', this.velocity.read.texture, 0);
    this.vorticity.texture('uCurl', this.curlField.texture, 1);
    this.vorticity.uniform1f('uCurlStrength', this.config.curl);
    this.vorticity.uniform1f('uDt', dt);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // Divergence.
    this.divergence.bind();
    this.setTexel(this.divergence, velTexel);
    this.divergence.texture('uVelocity', this.velocity.read.texture, 0);
    this.blit(this.divergenceField);

    // Decay pressure.
    this.clear.bind();
    this.clear.texture('uTexture', this.pressureField.read.texture, 0);
    this.clear.uniform1f('uValue', this.config.pressure);
    this.blit(this.pressureField.write);
    this.pressureField.swap();

    // Jacobi pressure solve.
    this.pressure.bind();
    this.setTexel(this.pressure, velTexel);
    this.pressure.texture('uDivergence', this.divergenceField.texture, 0);
    for (let i = 0; i < this.config.pressureIterations; i++) {
      this.pressure.texture('uPressure', this.pressureField.read.texture, 1);
      this.blit(this.pressureField.write);
      this.pressureField.swap();
    }

    // Subtract pressure gradient → divergence-free velocity.
    this.gradientSubtract.bind();
    this.setTexel(this.gradientSubtract, velTexel);
    this.gradientSubtract.texture('uPressure', this.pressureField.read.texture, 0);
    this.gradientSubtract.texture('uVelocity', this.velocity.read.texture, 1);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // Advect velocity.
    this.advection.bind();
    this.setTexel(this.advection, this.velocity.read);
    this.advection.uniform2f('uDyeTexel', this.velocity.read.texelX, this.velocity.read.texelY);
    this.advection.texture('uVelocity', this.velocity.read.texture, 0);
    this.advection.texture('uSource', this.velocity.read.texture, 1);
    this.advection.uniform1f('uDt', dt);
    this.advection.uniform1f('uDissipation', this.config.velocityDissipation);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // Advect dye.
    this.advection.bind();
    this.setTexel(this.advection, this.velocity.read);
    this.advection.uniform2f('uDyeTexel', this.dye.read.texelX, this.dye.read.texelY);
    this.advection.texture('uVelocity', this.velocity.read.texture, 0);
    this.advection.texture('uSource', this.dye.read.texture, 1);
    this.advection.uniform1f('uDt', dt);
    this.advection.uniform1f('uDissipation', this.config.densityDissipation);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  // ---- Post-processing ------------------------------------------------------

  private applyBloom(source: FBO): void {
    if (this.bloomMips.length < 2) return;
    const gl = this.gl;
    gl.disable(gl.BLEND);

    const knee = this.config.bloomThreshold * this.config.bloomSoftKnee + 1e-4;
    const curve0 = this.config.bloomThreshold - knee;
    const curve1 = knee * 2;
    const curve2 = 0.25 / knee;

    this.bloomPrefilter.bind();
    this.bloomPrefilter.uniform3f('uCurve', curve0, curve1, curve2);
    this.bloomPrefilter.uniform1f('uThreshold', this.config.bloomThreshold);
    this.bloomPrefilter.texture('uTexture', source.texture, 0);
    this.blit(this.bloomMips[0]);

    // Downsample.
    let last = this.bloomMips[0];
    this.bloomBlur.bind();
    for (let i = 1; i < this.bloomMips.length; i++) {
      this.setTexel(this.bloomBlur, last);
      this.bloomBlur.texture('uTexture', last.texture, 0);
      this.blit(this.bloomMips[i]);
      last = this.bloomMips[i];
    }

    // Upsample, additively blending each level back in.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.bloomMips.length - 2; i >= 0; i--) {
      const target = this.bloomMips[i];
      this.setTexel(this.bloomBlur, last);
      this.bloomBlur.texture('uTexture', last.texture, 0);
      this.blit(target);
      last = target;
    }
    gl.disable(gl.BLEND);

    this.bloomFinal.bind();
    this.setTexel(this.bloomFinal, last);
    this.bloomFinal.uniform1f('uIntensity', this.config.bloomIntensity);
    this.bloomFinal.texture('uTexture', last.texture, 0);
    this.blit(this.bloomTarget);
  }

  private applySunrays(source: FBO): void {
    const gl = this.gl;
    gl.disable(gl.BLEND);

    this.sunraysMask.bind();
    this.sunraysMask.texture('uTexture', source.texture, 0);
    this.blit(this.sunraysTemp);

    this.sunraysProgram.bind();
    this.sunraysProgram.uniform1f('uWeight', this.config.sunraysWeight);
    this.sunraysProgram.texture('uTexture', this.sunraysTemp.texture, 0);
    this.blit(this.sunraysTarget);

    // Light blur to soften the rays.
    this.bloomBlur.bind();
    this.setTexel(this.bloomBlur, this.sunraysTarget);
    this.bloomBlur.texture('uTexture', this.sunraysTarget.texture, 0);
    this.blit(this.sunraysTemp);
    this.setTexel(this.bloomBlur, this.sunraysTemp);
    this.bloomBlur.texture('uTexture', this.sunraysTemp.texture, 0);
    this.blit(this.sunraysTarget);
  }

  private displayProgram(): Program {
    const defines: string[] = [];
    if (this.config.shading) defines.push('SHADING');
    if (this.config.bloom) defines.push('BLOOM');
    if (this.config.sunrays) defines.push('SUNRAYS');
    const key = defines.join('|') || 'plain';
    let prog = this.displayCache.get(key);
    if (!prog) {
      prog = new Program(this.gl, baseVert, withDefines(displayFrag, defines), `display:${key}`);
      this.displayCache.set(key, prog);
    }
    return prog;
  }

  render(time: number): void {
    const gl = this.gl;
    if (this.config.bloom) this.applyBloom(this.dye.read);
    if (this.config.sunrays) this.applySunrays(this.dye.read);

    const p = this.displayProgram();
    p.bind();
    this.setTexel(p, this.dye.read);
    p.texture('uTexture', this.dye.read.texture, 0);
    if (this.config.bloom) {
      p.texture('uBloom', this.bloomTarget.texture, 1);
      p.texture('uDither', this.dither, 2);
      const w = gl.drawingBufferWidth / this.ditherSize;
      const h = gl.drawingBufferHeight / this.ditherSize;
      p.uniform2f('uDitherScale', w, h);
    }
    if (this.config.sunrays) p.texture('uSunrays', this.sunraysTarget.texture, 3);
    p.uniform1f('uBloomIntensity', this.config.bloomIntensity);
    p.uniform1f('uExposure', this.config.exposure);
    p.uniform1f('uVignette', this.config.vignette);
    p.uniform1f('uGrain', this.config.grain);
    p.uniform1f('uTime', time);
    this.blit(null);
  }

  // ---- Lifecycle ------------------------------------------------------------

  /** Clear all dye and velocity (used by reset / palette background swaps). */
  reset(): void {
    const gl = this.gl;
    for (const dfbo of [this.velocity, this.dye, this.pressureField]) {
      for (const fbo of [dfbo.read, dfbo.write]) {
        fbo.bind();
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
  }

  /** Background color from the active palette, for the canvas clear / CSS. */
  backgroundHex(): string {
    return getPalette(this.config.palette).background;
  }

  /** Apply config changes; recreates framebuffers if a resolution changed. */
  updateConfig(next: SimConfig): void {
    const resChanged =
      next.simResolution !== this.config.simResolution ||
      next.dyeResolution !== this.config.dyeResolution;
    this.config = next;
    if (resChanged) this.initFramebuffers();
  }

  /** Re-derive framebuffer sizes after a canvas resize. */
  resize(): void {
    const sim = this.resolution(this.config.simResolution);
    if (sim.width !== this.velocity.width || sim.height !== this.velocity.height) {
      this.initFramebuffers();
    } else {
      this.initPostFramebuffers();
    }
  }

  dispose(): void {
    this.velocity.dispose();
    this.dye.dispose();
    this.pressureField.dispose();
    this.divergenceField.dispose();
    this.curlField.dispose();
    this.bloomTarget.dispose();
    for (const m of this.bloomMips) m.dispose();
    this.sunraysTarget.dispose();
    this.sunraysTemp.dispose();
    this.gl.deleteTexture(this.dither);
    this.quad.dispose();
    for (const p of [
      this.copy, this.advection, this.divergence, this.curl, this.vorticity,
      this.pressure, this.gradientSubtract, this.clear, this.splatProgram,
      this.bloomPrefilter, this.bloomBlur, this.bloomFinal, this.sunraysMask, this.sunraysProgram,
    ]) p.dispose();
    for (const p of this.displayCache.values()) p.dispose();
  }
}
