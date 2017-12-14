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
import 'three/examples/js/shaders/CopyShader'

export default class EffectComposer extends Three.EffectComposer {
  dispose() {
    this.renderTarget1.dispose()
    this.renderTarget2.dispose()
    for (let i = 0; i < this.passes.length; ++i) {
      const pass = this.passes[i]
      if (pass.dispose) {
        pass.dispose()
      }
    }
  }

  addPass(pass) {
    this.passes.push(pass)
    const { width, height } = this.renderer.getSize()
    const pixelRatio = this.renderer.getPixelRatio()
    pass.setSize(width, height, pixelRatio)
  }

  insertPass(pass, index) {
    this.passes.splice(index, 0, pass)
    const { width, height } = this.renderer.getSize()
    const pixelRatio = this.renderer.getPixelRatio()
    pass.setSize(width, height, pixelRatio)
  }

  setSize(width, height, pixelRatio = 1) {
    const deviceWidth = width * pixelRatio
    const deviceHeight = height * pixelRatio
    this.renderTarget1.setSize(deviceWidth, deviceHeight)
    this.renderTarget2.setSize(deviceWidth, deviceHeight)

    for (let i = 0; i < this.passes.length; ++i) {
      this.passes[i].setSize(width, height, pixelRatio)
    }
  }
}
