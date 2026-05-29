// Shader compilation + program wrapper with cached uniform locations.

/**
 * Inserts `#define` lines immediately after the `#version` directive, which must
 * remain the first line of a GLSL ES 3.00 source. Used to compile shader variants
 * (e.g. manual bilinear filtering, optional shading/bloom in the display pass).
 */
export function withDefines(source: string, defines: readonly string[]): string {
  if (defines.length === 0) return source;
  const block = defines.map((d) => `#define ${d}`).join('\n');
  const versionMatch = source.match(/^\s*#version[^\n]*\n/);
  if (versionMatch) {
    const idx = versionMatch[0].length;
    return source.slice(0, idx) + block + '\n' + source.slice(idx);
  }
  return block + '\n' + source;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
  label: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error(`Failed to allocate ${label} shader`);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown error';
    gl.deleteShader(shader);
    throw new Error(`${label} shader compile failed:\n${log}`);
  }
  return shader;
}

export class Program {
  readonly program: WebGLProgram;
  private readonly gl: WebGL2RenderingContext;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();

  constructor(gl: WebGL2RenderingContext, vertexSrc: string, fragmentSrc: string, label = 'program') {
    this.gl = gl;
    const vert = compileShader(gl, gl.VERTEX_SHADER, vertexSrc, `${label}:vert`);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc, `${label}:frag`);

    const program = gl.createProgram();
    if (!program) throw new Error(`Failed to allocate ${label}`);
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    // Shaders can be flagged for deletion immediately after a successful link.
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? 'unknown error';
      gl.deleteProgram(program);
      throw new Error(`${label} link failed:\n${log}`);
    }
    this.program = program;
  }

  bind(): void {
    this.gl.useProgram(this.program);
  }

  private location(name: string): WebGLUniformLocation | null {
    let loc = this.uniforms.get(name);
    if (loc === undefined) {
      loc = this.gl.getUniformLocation(this.program, name);
      this.uniforms.set(name, loc);
    }
    return loc;
  }

  uniform1i(name: string, value: number): void {
    this.gl.uniform1i(this.location(name), value);
  }

  uniform1f(name: string, value: number): void {
    this.gl.uniform1f(this.location(name), value);
  }

  uniform2f(name: string, x: number, y: number): void {
    this.gl.uniform2f(this.location(name), x, y);
  }

  uniform3f(name: string, x: number, y: number, z: number): void {
    this.gl.uniform3f(this.location(name), x, y, z);
  }

  uniform4f(name: string, x: number, y: number, z: number, w: number): void {
    this.gl.uniform4f(this.location(name), x, y, z, w);
  }

  /** Bind a texture to a unit and point the named sampler at it. */
  texture(name: string, texture: WebGLTexture, unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.location(name), unit);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.uniforms.clear();
  }
}
