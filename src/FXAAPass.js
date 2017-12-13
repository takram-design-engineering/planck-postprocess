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

import * as Three from 'three'

import 'three/examples/js/postprocessing/EffectComposer'
import 'three/examples/js/postprocessing/ShaderPass'

import fragmentShader from './shader/fxaa_frag.glsl'
import vertexShader from './shader/fxaa_vert.glsl'

export default class FXAAPass extends Three.ShaderPass {
  constructor({
    quality = 12,
    subpix = 0.75,
    edgeThreshold = 0.125,
    edgeThresholdMin = 0.0625,
  } = {}) {
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new Three.Vector2(1 / 512, 1 / 512) },
        subpix: { value: subpix },
        edgeThreshold: { value: edgeThreshold },
        edgeThresholdMin: { value: edgeThresholdMin },
      },
      defines: {
        FXAA_QUALITY_PRESET: quality,
      },
      vertexShader,
      fragmentShader,
    }
    super(shader)
  }

  setSize(width, height) {
    this.uniforms.resolution.value.set(1 / width, 1 / height)
  }
}
