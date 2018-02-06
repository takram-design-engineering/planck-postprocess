// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

import * as Three from 'three'

export default class RenderPass extends Three.Pass {
  constructor(scene, camera, overrideMaterial, clearColor, clearAlpha) {
    super()
    this.scene = scene
    this.camera = camera
    this.overrideMaterial = overrideMaterial
    this.clearColor = clearColor
    this.clearAlpha = clearAlpha !== undefined ? clearAlpha : 0
    this.clear = true
    this.clearDepth = false
    this.needsSwap = false
    this.info = {
      render: {},
      memory: {},
      programs: [],
    }
  }

  render(renderer, writeBuffer, readBuffer, delta, maskActive) {
    const { autoClear } = renderer
    // eslint-disable-next-line no-param-reassign
    renderer.autoClear = false

    let clearColor
    let clearAlpha
    if (this.clearColor) {
      clearColor = renderer.getClearColor().getHex()
      clearAlpha = renderer.getClearAlpha()
      renderer.setClearColor(this.clearColor, this.clearAlpha)
    }
    if (this.clearDepth) {
      renderer.clearDepth()
    }

    this.scene.overrideMaterial = this.overrideMaterial
    this.onBeforeRender(renderer, this.scene, this.camera)
    if (this.renderToScreen) {
      renderer.render(this.scene, this.camera, undefined, this.clear)
    } else {
      renderer.render(this.scene, this.camera, readBuffer, this.clear)
    }
    this.info = {
      render: { ...renderer.info.render },
      memory: { ...renderer.info.memory },
      programs: [...renderer.info.programs],
    }
    this.onAfterRender(renderer, this.scene, this.camera)
    this.scene.overrideMaterial = null

    // eslint-disable-next-line no-param-reassign
    renderer.autoClear = autoClear
    if (this.clearColor) {
      renderer.setClearColor(clearColor, clearAlpha)
    }
  }

  onBeforeRender(renderer, scene, camera) {}

  onAfterRender(renderer, scene, camera) {}
}
