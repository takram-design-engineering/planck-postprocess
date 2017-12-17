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

import fragmentShader from './shader/fxaa_frag.glsl'
import ShaderPass from './ShaderPass'
import vertexShader from './shader/fxaa_vert.glsl'

export default class FXAAPass extends ShaderPass {
  constructor(width = 256, height = 256, pixelRatio = 1, quality = 12, {
    subpix = 0.75,
    edgeThreshold = 0.125,
    edgeThresholdMin = 0.0625,
  } = {}) {
    const deviceWidth = width * pixelRatio
    const deviceHeight = height * pixelRatio
    super({
      defines: {
        FXAA_QUALITY_PRESET: quality,
      },
      uniforms: {
        tDiffuse: { value: null },
        resolution: {
          value: new Three.Vector2(1 / deviceWidth, 1 / deviceHeight),
        },
        subpix: { value: subpix },
        edgeThreshold: { value: edgeThreshold },
        edgeThresholdMin: { value: edgeThresholdMin },
      },
      vertexShader,
      fragmentShader,
    })
  }

  setSize(width, height, pixelRatio = 1) {
    const deviceWidth = width * pixelRatio
    const deviceHeight = height * pixelRatio
    this.uniforms.resolution.value.set(1 / deviceWidth, 1 / deviceHeight)
  }

  get subpix() {
    return this.uniforms.subpix.value
  }

  set subpix(value) {
    this.uniforms.subpix.value = value
  }

  get edgeThreshold() {
    return this.uniforms.edgeThreshold.value
  }

  set edgeThreshold(value) {
    this.uniforms.edgeThreshold.value = value
  }

  get edgeThresholdMin() {
    return this.uniforms.edgeThresholdMin.value
  }

  set edgeThresholdMin(value) {
    this.uniforms.edgeThresholdMin.value = value
  }
}
