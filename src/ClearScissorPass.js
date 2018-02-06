// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

import * as Three from 'three'

export default class ClearScissorPass extends Three.Pass {
  constructor() {
    super()
    this.needsSwap = false
  }

  render(renderer, writeBuffer, readBuffer, delta, maskActive) {
    // eslint-disable-next-line no-param-reassign
    readBuffer.scissorTest = false
    // eslint-disable-next-line no-param-reassign
    writeBuffer.scissorTest = false
  }
}
