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

import Namespace from '@takram/planck-core/src/Namespace'

import 'three/examples/js/postprocessing/EffectComposer'
import 'three/examples/js/postprocessing/ShaderPass'
import 'three/examples/js/shaders/CopyShader'

import BloomPass from './BloomPass'
import EffectComposer from './EffectComposer'
import FXAAPass from './FXAAPass'
import TiltShiftPass from './TiltShiftPass'
import VignettePass from './VignettePass'

export const internal = Namespace('Postprocess')

export default class Postprocess {
  constructor(renderer) {
    const scope = internal(this)
    scope.renderer = renderer

    // The primary render target
    const { width, height } = renderer.getSize()
    const pixelRatio = this.renderer.getPixelRatio()
    const deviceWidth = width * pixelRatio
    const deviceHeight = height * pixelRatio

    // Another offscreen render target is required for bloom pass
    this.bloomTarget = new Three.WebGLRenderTarget(
      deviceWidth,
      deviceHeight, {
        minFilter: Three.LinearFilter,
        magFilter: Three.LinearFilter,
        format: Three.RGBFormat,
      },
    )

    // Shader passes
    this.fxaaPass = new FXAAPass()
    this.bloomPass = new BloomPass(deviceWidth, deviceHeight, 1, 0.5, 0.5)
    this.tiltShiftPass = new TiltShiftPass()
    this.vignettePass = new VignettePass()

    // Disable FXAA pass pass by default
    this.fxaaPass.enabled = false

    // Disable bloom pass pass by default
    this.bloomPass.enabled = false
    this.bloomPass.highPassUniforms.smoothWidth.value = 0.1
    this.bloomPass.readBuffer = this.bloomTarget

    // Effect composer
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(this.fxaaPass)
    this.composer.addPass(this.bloomPass)
    this.composer.addPass(this.tiltShiftPass)
    this.composer.addPass(this.vignettePass)
    this.ensureRenderToScreen()
    this.setSize(width, height)
  }

  render(scene, camera) {
    const { renderer, bloomPass } = this
    if (bloomPass.enabled && bloomPass.needsSeparateRender) {
      const { layers } = camera
      // eslint-disable-next-line no-param-reassign
      camera.layers = this.bloomPass.layers
      renderer.clearTarget(this.bloomTarget)
      renderer.render(scene, camera, this.bloomTarget)
      bloomPass.readBuffer = this.bloomTarget
      // eslint-disable-next-line no-param-reassign
      camera.layers = layers
    }
    this.composer.render()
  }

  setSize(width, height) {
    const pixelRatio = this.renderer.getPixelRatio()
    this.composer.setSize(width, height, pixelRatio)
    const deviceWidth = width * pixelRatio
    const deviceHeight = height * pixelRatio
    this.bloomTarget.setSize(deviceWidth, deviceHeight)
  }

  ensureRenderToScreen() {
    let lastPass
    for (let i = 0; i < this.composer.passes.length; ++i) {
      const pass = this.composer.passes[i]
      pass.renderToScreen = false
      if (pass.enabled) {
        lastPass = pass
      }
    }
    if (lastPass) {
      lastPass.renderToScreen = true
    }
  }

  get renderer() {
    const scope = internal(this)
    return scope.renderer
  }

  get info() {
    return this.renderPass.info
  }
}
