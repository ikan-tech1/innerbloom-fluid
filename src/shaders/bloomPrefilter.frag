#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec3 uCurve;     // x: threshold-knee, y: threshold, z: 1/(4*knee)
uniform float uThreshold;

void main() {
  vec3 c = texture(uTexture, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  // Soft-knee threshold so the bloom ramps in smoothly above the cutoff.
  float rq = clamp(br - uCurve.x, 0.0, uCurve.y);
  rq = uCurve.z * rq * rq;
  float contribution = max(rq, br - uThreshold) / max(br, 1e-4);
  fragColor = vec4(c * contribution, 1.0);
}
