// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

import * as Three from 'three'

export default class ClearScissorPass extends Three.Pass {
  constructor () {
    super()
    this.needsSwap = false
  }

  render (renderer, writeBuffer, readBuffer, delta, maskActive) {
    readBuffer.scissorTest = false
    writeBuffer.scissorTest = false
  }
}
