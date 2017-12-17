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
  constructor(width = 256, height = 256, {
    strength = 1,
    radius = 0.5,
    threshold = 0.5,
  } = {}) {
    // UnrealBloomPass divides the resolution by 2 for the bright render target
    // and the largest mipmap target, that makes light bleeding much visible.
    // Use the twice larger resolution here to minimize that.
    const resolution = new Three.Vector2(width * 2, height * 2)
    super(resolution, strength, radius, threshold)
    this.needsSeparateRender = false
    this.separateCamera = null
    this.separateScene = null
    this.layers = new Three.Layers()
  }

  render(renderer, writeBuffer, readBuffer, delta, maskActive) {
    const { autoClear } = renderer
    // eslint-disable-next-line no-param-reassign
    renderer.autoClear = false
    const clearColor = renderer.getClearColor().getHex()
    const clearAlpha = renderer.getClearAlpha()
    renderer.setClearColor(new Three.Color(0, 0, 0), 0)
    if (maskActive) {
      renderer.context.disable(renderer.context.STENCIL_TEST)
    }

    // 1. Extract Bright Areas
    if (this.needsSeparateRender) {
      // Use the write buffer to render the separate scene to
      const {
        separateCamera: camera,
        separateScene: scene,
      } = this
      const { layers } = camera
      camera.layers = this.layers
      renderer.render(scene, camera, writeBuffer, true)
      camera.layers = layers
      this.highPassUniforms.tDiffuse.value = writeBuffer.texture
    } else {
      this.highPassUniforms.tDiffuse.value = readBuffer.texture
    }
    this.highPassUniforms.luminosityThreshold.value = this.threshold
    this.quad.material = this.materialHighPassFilter
    renderer.render(this.scene, this.camera, this.renderTargetBright, true)

    // 2. Blur all the mips progressively
    let renderTarget = this.renderTargetBright
    for (let i = 0; i < this.nMips; ++i) {
      const material = this.separableBlurMaterials[i]
      const horizontalRenderTarget = this.renderTargetsHorizontal[i]
      const verticalRenderTarget = this.renderTargetsVertical[i]
      this.quad.material = material
      material.uniforms.colorTexture.value = renderTarget.texture
      material.uniforms.direction.value = this.constructor.BlurDirectionX
      renderer.render(this.scene, this.camera, horizontalRenderTarget, true)
      material.uniforms.colorTexture.value = horizontalRenderTarget.texture
      material.uniforms.direction.value = this.constructor.BlurDirectionY
      renderer.render(this.scene, this.camera, verticalRenderTarget, true)
      renderTarget = verticalRenderTarget
    }

    // Composite all the mips
    const horizontalRenderTarget = this.renderTargetsHorizontal[0]
    this.quad.material = this.compositeMaterial
    this.compositeMaterial.uniforms.bloomStrength.value = this.strength
    this.compositeMaterial.uniforms.bloomRadius.value = this.radius
    this.compositeMaterial.uniforms.bloomTintColors.value = this.bloomTintColors
    renderer.render(this.scene, this.camera, horizontalRenderTarget, true)

    // Blend it additively over the input texture
    this.quad.material = this.materialCopy
    this.copyUniforms.tDiffuse.value = horizontalRenderTarget.texture

    if (maskActive) {
      renderer.context.enable(renderer.context.STENCIL_TEST)
    }
    if (this.renderToScreen) {
      renderer.render(this.scene, this.camera, undefined, false)
    } else {
      renderer.render(this.scene, this.camera, readBuffer, false)
    }

    // eslint-disable-next-line no-param-reassign
    renderer.autoClear = autoClear
    if (this.clearColor) {
      renderer.setClearColor(clearColor, clearAlpha)
    }
  }

  setSize(width, height) {
    // The same discussion in the constructor
    super.setSize(width * 2, height * 2)
  }
}
