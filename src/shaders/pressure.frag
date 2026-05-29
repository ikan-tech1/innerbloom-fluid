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
uniform sampler2D uDivergence;

void main() {
  float l = texture(uPressure, vL).x;
  float r = texture(uPressure, vR).x;
  float t = texture(uPressure, vT).x;
  float b = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  // One Jacobi iteration of the Poisson pressure equation.
  float pressure = (l + r + b + t - divergence) * 0.25;
  fragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
