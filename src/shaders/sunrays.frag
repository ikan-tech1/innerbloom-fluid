#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform float uWeight;

#define ITERATIONS 16

void main() {
  // Radial light-scattering ("god rays") from screen center along the dye mask.
  float density = 0.3;
  float decay = 0.95;
  float exposure = 0.7;

  vec2 coord = vUv;
  vec2 dir = vUv - 0.5;
  dir *= 1.0 / float(ITERATIONS) * density;

  float color = texture(uTexture, vUv).a;
  float illuminationDecay = 1.0;

  for (int i = 0; i < ITERATIONS; i++) {
    coord -= dir;
    float s = texture(uTexture, coord).a;
    s *= illuminationDecay * uWeight;
    color += s;
    illuminationDecay *= decay;
  }

  fragColor = vec4(color * exposure, 0.0, 0.0, 1.0);
}
