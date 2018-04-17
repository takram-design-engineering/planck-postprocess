// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

import EffectComposer from './EffectComposer'
import TiltShiftPass from './TiltShiftPass'
import VignettePass from './VignettePass'

export default class Postprocess {
  constructor (renderer) {
    this.renderer = renderer
    this.composer = new EffectComposer(this.renderer)
    this.tiltShiftPass = new TiltShiftPass()
    this.composer.addPass(this.tiltShiftPass)
    this.vignettePass = new VignettePass()
    this.composer.addPass(this.vignettePass)
    this.ensureRenderToScreen()
  }

  render (scene, camera) {
    this.composer.render()
  }

  setSize (width, height) {
    const pixelRatio = this.renderer.getPixelRatio()
    this.composer.setSize(width, height, pixelRatio)
  }

  addPass (pass) {
    this.composer.addPass(pass)
  }

  insertPass (pass, index) {
    this.composer.insertPass(pass, index)
  }

  ensureRenderToScreen () {
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
