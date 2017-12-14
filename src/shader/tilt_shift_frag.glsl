// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

#ifndef KERNEL_SIZE
  #define KERNEL_SIZE 9
#endif

uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform vec2 direction;
uniform float center;
uniform float radius;
uniform float radiusLimit;

varying vec2 vUv;

void main() {
  vec4 color = vec4(0.0);
  float gradient = pow(abs((center * 0.5 + 0.5) - vUv.y) * 2.0, 2.0);
  vec2 aspect = vec2(resolution.y / resolution.x, 1.0);
  vec2 amount = min(radius * gradient * aspect / resolution.y, radiusLimit);
  vec2 offset = amount * direction;

  #if KERNEL_SIZE == 9
    color += texture2D(tDiffuse, vUv) * 0.162443;
    color += texture2D(tDiffuse, vUv + offset) * 0.151793;
    color += texture2D(tDiffuse, vUv - offset) * 0.151793;
    color += texture2D(tDiffuse, vUv + offset * 2.0) * 0.123853;
    color += texture2D(tDiffuse, vUv - offset * 2.0) * 0.123853;
    color += texture2D(tDiffuse, vUv + offset * 3.0) * 0.08824;
    color += texture2D(tDiffuse, vUv - offset * 3.0) * 0.08824;
    color += texture2D(tDiffuse, vUv + offset * 4.0) * 0.0548925;
    color += texture2D(tDiffuse, vUv - offset * 4.0) * 0.0548925;
  #endif

  #if KERNEL_SIZE == 7
    color += texture2D(tDiffuse, vUv) * 0.182476;
    color += texture2D(tDiffuse, vUv + offset) * 0.170513;
    color += texture2D(tDiffuse, vUv - offset) * 0.170513;
    color += texture2D(tDiffuse, vUv + offset * 2.0) * 0.139127;
    color += texture2D(tDiffuse, vUv - offset * 2.0) * 0.139127;
    color += texture2D(tDiffuse, vUv + offset * 3.0) * 0.099122;
    color += texture2D(tDiffuse, vUv - offset * 3.0) * 0.099122;
  #endif

  #if KERNEL_SIZE == 5
    color += texture2D(tDiffuse, vUv) * 0.227595;
    color += texture2D(tDiffuse, vUv + offset) * 0.212674;
    color += texture2D(tDiffuse, vUv - offset) * 0.212674;
    color += texture2D(tDiffuse, vUv + offset * 2.0) * 0.1735285;
    color += texture2D(tDiffuse, vUv - offset * 2.0) * 0.1735285;
  #endif

  gl_FragColor = color;
}
