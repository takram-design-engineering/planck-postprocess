// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

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
