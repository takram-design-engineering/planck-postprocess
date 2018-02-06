// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

#pragma glslify: blendSoftLight = require('./blend_soft_light.glsl')

uniform sampler2D tDiffuse;
uniform sampler2D tNoise;
uniform vec2 resolution;
uniform float amount;

varying vec2 vUv;

void main() {
  // Make vivider and darker
  vec4 pixel = texture2D(tDiffuse, vUv);
  vec3 color = pixel.rgb;
  vec2 uv = (vUv - vec2(0.5)) * 2.0 * vec2(
      clamp(resolution.x / resolution.y, 0.0, 1.0),
      clamp(resolution.y / resolution.x, 0.0, 1.0));
  float coeff = amount * dot(uv, uv);
  color = blendSoftLight(color, vec3(0.0), coeff);
  color = mix(color, vec3(0.0), vec3(coeff * 0.2));

  // Add noise to reduce banding
  float noise = texture2D(tNoise, fract(vUv * resolution / vec2(128.0))).r;
  color += mix(-1.0 / 64.0, 1.0 / 64.0, noise);

  gl_FragColor = vec4(color, pixel.a);
}
