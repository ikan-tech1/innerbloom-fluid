#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform float uIntensity;

void main() {
  vec4 sum = texture(uTexture, vL);
  sum += texture(uTexture, vR);
  sum += texture(uTexture, vT);
  sum += texture(uTexture, vB);
  fragColor = (sum * 0.25) * uIntensity;
}
