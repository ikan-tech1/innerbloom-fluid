// A single fullscreen triangle covering clip space [-1,1] with no vertex buffer
// indirection beyond one static VAO. One triangle (not two) avoids the diagonal
// seam and is marginally faster than a quad.

export class FullscreenQuad {
  private readonly gl: WebGL2RenderingContext;
  private readonly vao: WebGLVertexArrayObject;
  private readonly buffer: WebGLBuffer;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) throw new Error('Failed to allocate fullscreen quad buffers');
    this.vao = vao;
    this.buffer = buffer;

    // Oversized triangle: positions chosen so the [-1,1] viewport is fully covered.
    const verts = new Float32Array([-1, -1, 3, -1, -1, 3]);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /** Draw the triangle. Assumes a program is already bound and uniforms set. */
  draw(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteBuffer(this.buffer);
  }
}
