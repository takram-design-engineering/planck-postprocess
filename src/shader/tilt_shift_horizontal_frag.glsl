//
//  The MIT License
//
//  Copyright (C) 2016-Present Shota Matsuda
//
//  Permission is hereby granted, free of charge, to any person obtaining a
//  copy of this software and associated documentation files (the "Software"),
//  to deal in the Software without restriction, including without limitation
//  the rights to use, copy, modify, merge, publish, distribute, sublicense,
//  and/or sell copies of the Software, and to permit persons to whom the
//  Software is furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
//  DEALINGS IN THE SOFTWARE.
//

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
    color += texture2D(tDiffuse, vec2(vUv.x - 4.0 * coeff, vUv.y)) * 0.0548925;
    color += texture2D(tDiffuse, vec2(vUv.x - 3.0 * coeff, vUv.y)) * 0.08824;
    color += texture2D(tDiffuse, vec2(vUv.x - 2.0 * coeff, vUv.y)) * 0.123853;
    color += texture2D(tDiffuse, vec2(vUv.x - 1.0 * coeff, vUv.y)) * 0.151793;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.162443;
    color += texture2D(tDiffuse, vec2(vUv.x + 1.0 * coeff, vUv.y)) * 0.151793;
    color += texture2D(tDiffuse, vec2(vUv.x + 2.0 * coeff, vUv.y)) * 0.123853;
    color += texture2D(tDiffuse, vec2(vUv.x + 3.0 * coeff, vUv.y)) * 0.08824;
    color += texture2D(tDiffuse, vec2(vUv.x + 4.0 * coeff, vUv.y)) * 0.0548925;
  #endif

  #if (KERNEL_SIZE == 7)
    color += texture2D(tDiffuse, vec2(vUv.x - 3.0 * coeff, vUv.y)) * 0.099122;
    color += texture2D(tDiffuse, vec2(vUv.x - 2.0 * coeff, vUv.y)) * 0.139127;
    color += texture2D(tDiffuse, vec2(vUv.x - 1.0 * coeff, vUv.y)) * 0.170513;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.182476;
    color += texture2D(tDiffuse, vec2(vUv.x + 1.0 * coeff, vUv.y)) * 0.170513;
    color += texture2D(tDiffuse, vec2(vUv.x + 2.0 * coeff, vUv.y)) * 0.139127;
    color += texture2D(tDiffuse, vec2(vUv.x + 3.0 * coeff, vUv.y)) * 0.099122;
  #endif

  #if (KERNEL_SIZE == 5)
    color += texture2D(tDiffuse, vec2(vUv.x - 2.0 * coeff, vUv.y)) * 0.1735285;
    color += texture2D(tDiffuse, vec2(vUv.x - 1.0 * coeff, vUv.y)) * 0.212674;
    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.227595;
    color += texture2D(tDiffuse, vec2(vUv.x + 1.0 * coeff, vUv.y)) * 0.212674;
    color += texture2D(tDiffuse, vec2(vUv.x + 2.0 * coeff, vUv.y)) * 0.1735285;
  #endif

  gl_FragColor = color;
}
