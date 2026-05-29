#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;

void main() {
  vec4 c = texture(uTexture, vUv);
  // Darken transparent/low-density areas so rays emanate only from dense dye.
  float br = max(c.r, max(c.g, c.b));
  c.a = 1.0 - clamp(br * 20.0, 0.0, 0.8);
  fragColor = c;
}
