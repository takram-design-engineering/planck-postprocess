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

import EffectComposer from './EffectComposer'
import TiltShiftPass from './TiltShiftPass'
import VignettePass from './VignettePass'

export default class Postprocess {
  constructor(renderer) {
    this.renderer = renderer
    this.composer = new EffectComposer(this.renderer)
    this.tiltShiftPass = new TiltShiftPass()
    this.composer.addPass(this.tiltShiftPass)
    this.vignettePass = new VignettePass()
    this.composer.addPass(this.vignettePass)
    this.ensureRenderToScreen()
  }

  render(scene, camera) {
    this.composer.render()
  }

  setSize(width, height) {
    const pixelRatio = this.renderer.getPixelRatio()
    this.composer.setSize(width, height, pixelRatio)
  }

  addPass(pass) {
    this.composer.addPass(pass)
  }

  insertPass(pass, index) {
    this.composer.insertPass(pass, index)
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
}
