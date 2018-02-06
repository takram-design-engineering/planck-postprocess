// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

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
