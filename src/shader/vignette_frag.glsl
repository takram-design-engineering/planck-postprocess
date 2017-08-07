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

#pragma glslify: blendSoftLight = require('./blend_soft_light.glsl')

uniform sampler2D tDiffuse;
uniform sampler2D tNoise;

uniform vec2 size;
uniform float amount;

varying vec2 vUv;

void main() {
  // Make vivider and darker
  vec4 pixel = texture2D(tDiffuse, vUv);
  vec3 color = pixel.rgb;
  vec2 uv = (vUv - vec2(0.5)) * 2.0 * vec2(
    clamp(size.x / size.y, 0.0, 1.0),
    clamp(size.y / size.x, 0.0, 1.0));
  float coeff = amount * dot(uv, uv);
  color = blendSoftLight(color, vec3(0.0), coeff);
  color = mix(color, vec3(0.0), vec3(coeff * 0.2));

  // Add noise to reduce banding
  float noise = texture2D(tNoise, fract(vUv * size / vec2(128.0))).r;
  color += mix(-1.0 / 64.0, 1.0 / 64.0, noise);

  gl_FragColor = vec4(color, pixel.a);
}
