// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

import * as Three from 'three'

export default class ScissorPass extends Three.Pass {
  constructor (scissor) {
    super()
    this.scissor = scissor
    this.needsSwap = false
  }

  render (renderer, writeBuffer, readBuffer, delta, maskActive) {
    const { scissor } = this
    if (scissor) {
      let { x, y, z, w } = scissor
      if (scissor.width !== undefined && scissor.height !== undefined) {
        const { height } = renderer.getSize()
        y = height - y - scissor.height
        z = scissor.width
        w = scissor.height
      }
      const pixelRatio = renderer.getPixelRatio()
      x *= pixelRatio
      y *= pixelRatio
      z *= pixelRatio
      w *= pixelRatio
      readBuffer.scissorTest = true
      readBuffer.scissor.set(x, y, z, w)
      writeBuffer.scissorTest = true
      writeBuffer.scissor.set(x, y, z, w)
    }
  }
}
