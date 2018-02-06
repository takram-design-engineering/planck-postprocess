// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

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
