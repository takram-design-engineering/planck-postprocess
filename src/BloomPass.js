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
import 'three/examples/js/shaders/LuminosityHighPassShader'
import 'three/examples/js/postprocessing/UnrealBloomPass'

export default class BloomPass extends Three.UnrealBloomPass {
  constructor(width, height, ...rest) {
    super(new Three.Vector2(width, height), ...rest)

    // Parameters
    this.readBuffer = null
    this.needsSeparateRender = false
    this.layers = new Three.Layers()
    this.layers.set(1)
  }

  render(renderer, writeBuffer, readBuffer, delta, maskActive) {
    this.oldClearColor.copy(renderer.getClearColor())
    this.oldClearAlpha = renderer.getClearAlpha()
    const oldAutoClear = renderer.autoClear
    // eslint-disable-next-line no-param-reassign
    renderer.autoClear = false
    renderer.setClearColor(new Three.Color(0, 0, 0), 0)
    if (maskActive) {
      renderer.context.disable(renderer.context.STENCIL_TEST)
    }

    // 1. Extract Bright Areas
    if (this.needsSeparateRender) {
      this.highPassUniforms.tDiffuse.value = this.readBuffer.texture
    } else {
      this.highPassUniforms.tDiffuse.value = readBuffer.texture
    }
    this.highPassUniforms.luminosityThreshold.value = this.threshold
    this.quad.material = this.materialHighPassFilter
    renderer.render(this.scene, this.camera, this.renderTargetBright, true)

    // 2. Blur All the mips progressively
    let inputRenderTarget = this.renderTargetBright
    for (let i = 0; i < this.nMips; ++i) {
      const material = this.separableBlurMaterials[i]
      const horizontal = this.renderTargetsHorizontal[i]
      const vertical = this.renderTargetsVertical[i]
      this.quad.material = material
      material.uniforms.colorTexture.value = inputRenderTarget.texture
      material.uniforms.direction.value = Three.UnrealBloomPass.BlurDirectionX
      renderer.render(this.scene, this.camera, horizontal, true)
      material.uniforms.colorTexture.value = horizontal.texture
      material.uniforms.direction.value = Three.UnrealBloomPass.BlurDirectionY
      renderer.render(this.scene, this.camera, vertical, true)
      inputRenderTarget = vertical
    }

    // Composite All the mips
    const horizontal = this.renderTargetsHorizontal[0]
    this.quad.material = this.compositeMaterial
    this.compositeMaterial.uniforms.bloomStrength.value = this.strength
    this.compositeMaterial.uniforms.bloomRadius.value = this.radius
    this.compositeMaterial.uniforms.bloomTintColors.value = this.bloomTintColors
    renderer.render(this.scene, this.camera, horizontal, true)

    // Blend it additively over the input texture
    this.quad.material = this.materialCopy
    this.copyUniforms.tDiffuse.value = horizontal.texture

    if (maskActive) {
      renderer.context.enable(renderer.context.STENCIL_TEST)
    }
    renderer.render(this.scene, this.camera, readBuffer, false)
    renderer.setClearColor(this.oldClearColor, this.oldClearAlpha)
    // eslint-disable-next-line no-param-reassign
    renderer.autoClear = oldAutoClear
  }
}
