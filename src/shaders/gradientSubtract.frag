#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;

uniform sampler2D uPressure;
uniform sampler2D uVelocity;

void main() {
  float l = texture(uPressure, vL).x;
  float r = texture(uPressure, vR).x;
  float t = texture(uPressure, vT).x;
  float b = texture(uPressure, vB).x;
  vec2 vel = texture(uVelocity, vUv).xy;
  // Subtract the pressure gradient to make the field divergence-free.
  vel -= 0.5 * vec2(r - l, t - b);
  fragColor = vec4(vel, 0.0, 1.0);
}
