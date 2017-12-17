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
