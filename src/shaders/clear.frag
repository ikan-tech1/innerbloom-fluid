#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform float uValue;

void main() {
  // Used to decay pressure between frames (uValue < 1.0).
  fragColor = uValue * texture(uTexture, vUv);
}
