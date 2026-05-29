// Framebuffer object wrappers: a single render target plus a double-buffered
// (ping-pong) pair used by every simulation field.

import type { TexFormat } from './format';

export interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  /** 1/width, 1/height — handed to shaders as the texel step. */
  texelX: number;
  texelY: number;
  /** Bind this FBO and set the viewport to its size. */
  bind(): void;
  /** Bind this FBO's texture to a unit; returns the unit for chaining. */
  attach(unit: number): number;
  dispose(): void;
}

function createTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  fmt: TexFormat,
  filtering: number,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to allocate texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtering);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtering);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internalFormat, width, height, 0, fmt.format, fmt.type, null);
  return texture;
}

export function createFBO(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  fmt: TexFormat,
  filtering: number,
): FBO {
  const texture = createTexture(gl, width, height, fmt, filtering);
  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error('Failed to allocate framebuffer');
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return {
    texture,
    fbo,
    width,
    height,
    texelX: 1 / width,
    texelY: 1 / height,
    bind() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, width, height);
    },
    attach(unit: number) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return unit;
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(fbo);
    },
  };
}

/** A read/write pair. Simulation passes read `read` and render into `write`, then swap. */
export class DoubleFBO {
  private a: FBO;
  private b: FBO;

  constructor(
    gl: WebGL2RenderingContext,
    public width: number,
    public height: number,
    fmt: TexFormat,
    filtering: number,
  ) {
    this.a = createFBO(gl, width, height, fmt, filtering);
    this.b = createFBO(gl, width, height, fmt, filtering);
  }

  get read(): FBO {
    return this.a;
  }

  get write(): FBO {
    return this.b;
  }

  swap(): void {
    const tmp = this.a;
    this.a = this.b;
    this.b = tmp;
  }

  dispose(): void {
    this.a.dispose();
    this.b.dispose();
  }
}
