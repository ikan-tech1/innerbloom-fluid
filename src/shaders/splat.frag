#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTarget;
uniform float uAspect;
uniform vec3 uColor;     // velocity delta (xy) or dye color (rgb)
uniform vec2 uPoint;     // splat center in UV
uniform float uRadius;

void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  // Gaussian falloff stamped additively onto the existing field.
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  vec3 base = texture(uTarget, vUv).xyz;
  fragColor = vec4(base + splat, 1.0);
}
