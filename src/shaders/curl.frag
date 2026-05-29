#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;

uniform sampler2D uVelocity;

void main() {
  float l = texture(uVelocity, vL).y;
  float r = texture(uVelocity, vR).y;
  float t = texture(uVelocity, vT).x;
  float b = texture(uVelocity, vB).x;
  // 2D curl (scalar): dVy/dx - dVx/dy.
  float curl = 0.5 * (r - l - t + b);
  fragColor = vec4(curl, 0.0, 0.0, 1.0);
}
