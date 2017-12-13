
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

export default class ScissorPass extends Three.Pass {
  constructor(scissor) {
    super()
    this.scissor = scissor
    this.needsSwap = false
  }

  render(renderer, writeBuffer, readBuffer, delta, maskActive) {
    const { scissor } = this
    if (scissor) {
      let {
        x,
        y,
        z,
        w,
      } = scissor
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
      // eslint-disable-next-line no-param-reassign
      readBuffer.scissorTest = true
      readBuffer.scissor.set(x, y, z, w)
      // eslint-disable-next-line no-param-reassign
      writeBuffer.scissorTest = true
      writeBuffer.scissor.set(x, y, z, w)
    }
  }
}
