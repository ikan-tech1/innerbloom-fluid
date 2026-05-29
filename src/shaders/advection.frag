#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;        // texel size of the source being sampled
uniform vec2 uDyeTexel;     // texel size of the dye/source grid (for manual bilinear)
uniform float uDt;
uniform float uDissipation;

// Manual bilinear sampling for GPUs without OES_texture_float_linear.
#ifdef MANUAL_FILTERING
vec4 bilerp(sampler2D tex, vec2 uv, vec2 texel) {
  vec2 st = uv / texel - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture(tex, (iuv + vec2(0.5, 0.5)) * texel);
  vec4 b = texture(tex, (iuv + vec2(1.5, 0.5)) * texel);
  vec4 c = texture(tex, (iuv + vec2(0.5, 1.5)) * texel);
  vec4 d = texture(tex, (iuv + vec2(1.5, 1.5)) * texel);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}
#endif

void main() {
  // Semi-Lagrangian advection: trace velocity backwards and sample the source.
#ifdef MANUAL_FILTERING
  vec2 vel = bilerp(uVelocity, vUv, uTexel).xy;
  vec2 coord = vUv - uDt * vel * uTexel;
  vec4 result = bilerp(uSource, coord, uDyeTexel);
#else
  vec2 vel = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - uDt * vel * uTexel;
  vec4 result = texture(uSource, coord);
#endif
  // Exponential decay keeps dye/velocity from accumulating forever.
  float decay = 1.0 + uDissipation * uDt;
  fragColor = result / decay;
}
