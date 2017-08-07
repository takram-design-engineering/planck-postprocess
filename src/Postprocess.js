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

import 'three/examples/js/shaders/CopyShader'
import 'three/examples/js/shaders/SMAAShader'
import 'three/examples/js/postprocessing/EffectComposer'
import 'three/examples/js/postprocessing/SMAAPass'
import 'three/examples/js/postprocessing/SSAARenderPass'

import BloomPass from './BloomPass'
import FXAAPass from './FXAAPass'
import RenderPass from './RenderPass'
import ResolutionPass from './ResolutionPass'
import TiltShiftHorizontalPass from './TiltShiftHorizontalPass'
import TiltShiftVerticalPass from './TiltShiftVerticalPass'
import VignettePass from './VignettePass'

export const internal = Namespace('Postprocess')

export default class Postprocess {
  constructor({ renderer, width, height }) {
    const scope = internal(this)
    scope.renderer = renderer

    // Render target
    const pixelRatio = this.renderer.getPixelRatio()
    const deviceWidth = width * pixelRatio
    const deviceHeight = height * pixelRatio
    this.target = new Three.WebGLRenderTarget(
      deviceWidth, deviceHeight, {
        minFilter: Three.LinearFilter,
        magFilter: Three.LinearFilter,
        format: Three.RGBFormat,
        stencilBuffer: false,
      })
    this.bloomTarget = new Three.WebGLRenderTarget(
      deviceWidth, deviceHeight, {
        minFilter: Three.LinearFilter,
        magFilter: Three.LinearFilter,
        format: Three.RGBFormat,
        stencilBuffer: false,
      })

    // Shader passes
    this.renderPass = new RenderPass()
    this.fxaaPass = new FXAAPass()
    this.msaaPass = new Three.SSAARenderPass()
    this.smaaPass = new Three.SMAAPass(deviceWidth, deviceHeight)
    this.bloomPass = new BloomPass(deviceWidth, deviceHeight, 1, 0.5, 0.5)
    this.tiltShiftHorizontalPass = new TiltShiftHorizontalPass()
    this.tiltShiftVerticalPass = new TiltShiftVerticalPass()
    this.vignettePass = new VignettePass()
    this.resolutionPass = new ResolutionPass()

    // Disable antialias passes by default
    this.fxaaPass.enabled = false
    this.msaaPass.enabled = false
    this.smaaPass.enabled = false
    this.smaaPass.needsSwap = true
    this.bloomPass.enabled = false
    this.bloomPass.highPassUniforms.smoothWidth.value = 0.1
    this.bloomPass.readBuffer = this.bloomTarget

    // Effect composer
    this.composer = new Three.EffectComposer(this.renderer, this.target)
    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.fxaaPass)
    this.composer.addPass(this.msaaPass)
    this.composer.addPass(this.smaaPass)
    this.composer.addPass(this.bloomPass)
    this.composer.addPass(this.tiltShiftHorizontalPass)
    this.composer.addPass(this.tiltShiftVerticalPass)
    this.composer.addPass(this.vignettePass)
    this.composer.addPass(this.resolutionPass)
    this.ensureRenderToScreen()
    this.resize(width, height)
  }

  render(scene, camera) {
    const renderer = this.renderer
    renderer.clear()
    const bloomPass = this.bloomPass
    if (bloomPass.enabled && bloomPass.needsSeparateRender) {
      const mask = camera.layers.mask
      camera.layers.mask = this.bloomPass.layers.mask
      renderer.clearTarget(this.bloomTarget, true, true, true)
      renderer.render(scene, camera, this.bloomTarget)
      bloomPass.readBuffer = this.bloomTarget
      camera.layers.mask = mask
    }
    this.renderPass.scene = scene
    this.renderPass.camera = camera
    this.msaaPass.scene = scene
    this.msaaPass.camera = camera
    this.composer.render()
  }

  resize(width, height) {
    const pixelRatio = this.renderer.getPixelRatio()
    const deviceWidth = width * pixelRatio
    const deviceHeight = height * pixelRatio
    this.composer.setSize(deviceWidth, deviceHeight)
    this.bloomTarget.setSize(deviceWidth, deviceHeight)
  }

  ensureRenderToScreen() {
    let lastPass
    this.composer.passes.forEach(pass => {
      pass.renderToScreen = false
      if (pass.enabled) {
        lastPass = pass
      }
    })
    if (lastPass !== undefined) {
      lastPass.renderToScreen = true
    }
  }

  // Properties

  get renderer() {
    const scope = internal(this)
    return scope.renderer
  }

  get info() {
    return this.renderPass.info
  }
}
