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

import ShaderPass from './ShaderPass'

import fragmentShader from './shader/vignette_frag.glsl'
import noiseImage from './image/noise.png'
import vertexShader from './shader/vignette_vert.glsl'

export default class VignettePass extends ShaderPass {
  constructor(width = 256, height = 256, pixelRatio = 1, amount = 1) {
    const deviceWidth = width * pixelRatio
    const deviceHeight = height * pixelRatio
    super({
      uniforms: {
        tDiffuse: { value: null },
        tNoise: { value: null },
        resolution: { value: new Three.Vector2(deviceWidth, deviceHeight) },
        amount: { value: amount },
      },
      vertexShader,
      fragmentShader,
    })
    this.uniforms.tNoise.value = new Three.TextureLoader().load(noiseImage)
  }

  dispose() {
    super.dispose()
    this.uniforms.tNoise.value.dispose()
  }

  setSize(width, height, pixelRatio = 1) {
    const deviceWidth = width * pixelRatio
    const deviceHeight = height * pixelRatio
    this.uniforms.resolution.value.set(deviceWidth, deviceHeight)
  }

  get amount() {
    return this.uniforms.amount.value
  }

  set amount(value) {
    this.uniforms.amount.value = value
  }
}
