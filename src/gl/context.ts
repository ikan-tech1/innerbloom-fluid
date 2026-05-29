// WebGL2 context creation + capability detection.

export interface GLCapabilities {
  /** Can we render to RGBA float (RGBA32F) targets? */
  supportsFloat: boolean;
  /** Can we render to half-float (RGBA16F) targets? */
  supportsHalfFloat: boolean;
  /** Can float/half-float color textures be sampled with LINEAR filtering? */
  supportsLinearFloat: boolean;
  /** Max texture dimension the GPU reports. */
  maxTextureSize: number;
}

export interface GLContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  caps: GLCapabilities;
}

const CONTEXT_ATTRS: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
  premultipliedAlpha: false,
  powerPreference: 'high-performance',
  // Helps keep the simulation alive instead of black-screening on a GPU reset.
  failIfMajorPerformanceCaveat: false,
};

export class WebGLUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebGLUnsupportedError';
  }
}

/**
 * Detects whether a given internal/format combo is color-renderable by
 * actually attaching it to a framebuffer and checking completeness. This is
 * the only reliable cross-GPU check — extension presence alone lies.
 */
function isRenderable(
  gl: WebGL2RenderingContext,
  internalFormat: number,
  format: number,
  type: number,
): boolean {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(tex);

  return status === gl.FRAMEBUFFER_COMPLETE;
}

function detectCapabilities(gl: WebGL2RenderingContext): GLCapabilities {
  // Required to actually *render into* float textures in WebGL2.
  const colorFloat = gl.getExtension('EXT_color_buffer_float');
  // Enables LINEAR sampling of float textures (otherwise we bilinear-sample in-shader).
  const linearFloat = gl.getExtension('OES_texture_float_linear');

  const supportsHalfFloat =
    !!colorFloat && isRenderable(gl, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  const supportsFloat =
    !!colorFloat && isRenderable(gl, gl.RGBA32F, gl.RGBA, gl.FLOAT);

  return {
    supportsFloat,
    supportsHalfFloat,
    supportsLinearFloat: !!linearFloat,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
  };
}

export function createGLContext(canvas: HTMLCanvasElement): GLContext {
  const gl = canvas.getContext('webgl2', CONTEXT_ATTRS);
  if (!gl) {
    throw new WebGLUnsupportedError(
      'WebGL2 is not available in this browser. Try a recent version of Chrome, Firefox, Edge, or Safari.',
    );
  }

  const caps = detectCapabilities(gl);
  if (!caps.supportsFloat && !caps.supportsHalfFloat) {
    throw new WebGLUnsupportedError(
      'This GPU/browser cannot render to floating-point textures, which the fluid simulation requires.',
    );
  }

  return { gl, canvas, caps };
}
