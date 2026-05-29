#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;

uniform sampler2D uTexture;   // dye
uniform sampler2D uBloom;
uniform sampler2D uSunrays;
uniform sampler2D uDither;
uniform vec2 uDitherScale;
uniform float uBloomIntensity;
uniform float uExposure;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;

vec3 linearToGamma(vec3 c) {
  c = max(c, vec3(0.0));
  return max(1.055 * pow(c, vec3(0.41666)) - 0.055, vec3(0.0));
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 c = texture(uTexture, vUv).rgb;

#ifdef SHADING
  // Fake lit liquid: build a normal from the dye-luminance gradient and add a
  // soft directional highlight so pours read as having depth.
  vec3 lc = texture(uTexture, vL).rgb;
  vec3 rc = texture(uTexture, vR).rgb;
  vec3 tc = texture(uTexture, vT).rgb;
  vec3 bc = texture(uTexture, vB).rgb;
  float dx = length(rc) - length(lc);
  float dy = length(tc) - length(bc);
  vec3 n = normalize(vec3(dx, dy, length(uDitherScale) * 0.0 + 0.18));
  vec3 l = normalize(vec3(0.35, 0.6, 0.7));
  float diffuse = clamp(dot(n, l) + 0.75, 0.6, 1.25);
  c *= diffuse;
#endif

#ifdef BLOOM
  vec3 bloom = texture(uBloom, vUv).rgb;
  // Dither the bloom to break up banding in the dark falloff.
  float noise = texture(uDither, vUv * uDitherScale).r;
  noise = noise * 2.0 - 1.0;
  bloom += noise / 255.0;
  c += bloom * uBloomIntensity;
#endif

#ifdef SUNRAYS
  float rays = texture(uSunrays, vUv).r;
  c *= mix(0.7, 1.0, rays);
#endif

  c *= uExposure;

  // Vignette to focus the eye and deepen the near-black edges.
  vec2 q = vUv - 0.5;
  float vig = 1.0 - uVignette * dot(q, q);
  c *= vig;

  c = linearToGamma(c);

  // Subtle film grain for an analog, macro-photography texture.
  float g = hash(vUv * 1024.0 + uTime) - 0.5;
  c += g * uGrain;

  fragColor = vec4(c, 1.0);
}
