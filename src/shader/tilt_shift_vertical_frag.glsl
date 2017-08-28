// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

#ifndef KERNEL_SIZE
  #define KERNEL_SIZE ${size}
#endif

uniform sampler2D tDiffuse;
uniform float amount;
uniform float center;
uniform float limit;

varying vec2 vUv;

void main() {
  vec4 color = vec4(0.0);
  float coeff = clamp(amount * pow(abs(center - vUv.y) * 2.0, 2.0), 0.0, limit);

  #if (KERNEL_SIZE == 9)
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 4.0 * coeff)) * 0.0548925;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 3.0 * coeff)) * 0.08824;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * coeff)) * 0.123853;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * coeff)) * 0.151793;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.162443;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * coeff)) * 0.151793;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * coeff)) * 0.123853;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 3.0 * coeff)) * 0.08824;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 4.0 * coeff)) * 0.0548925;
  #endif

  #if (KERNEL_SIZE == 7)
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 3.0 * coeff)) * 0.099122;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * coeff)) * 0.139127;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * coeff)) * 0.170513;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.182476;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * coeff)) * 0.170513;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * coeff)) * 0.139127;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 3.0 * coeff)) * 0.099122;
  #endif

  #if (KERNEL_SIZE == 5)
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * coeff)) * 0.1735285;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * coeff)) * 0.212674;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.227595;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * coeff)) * 0.212674;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * coeff)) * 0.1735285;
  #endif

  gl_FragColor = color;
}
