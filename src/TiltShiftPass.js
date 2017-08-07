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

import Namespace from '@takram/planck-core/src/Namespace'

import 'three/examples/js/postprocessing/EffectComposer'
import 'three/examples/js/postprocessing/ShaderPass'

export const internal = Namespace('TiltShiftPass')

export default class TiltShiftPass extends Three.ShaderPass {
  constructor(shader, { amount = 9, center = 0 } = {}) {
    super(shader)
    this.denominator = 1000
    this.amount = amount
    this.center = center
  }

  setSize(width, height) {
    this.uniforms.amount.value = this.amount / this.denominator
  }

  get amount() {
    const scope = internal(this)
    return scope.amount
  }

  set amount(value) {
    const scope = internal(this)
    scope.amount = value
    this.uniforms.amount.value = value / this.denominator
  }

  get center() {
    const scope = internal(this)
    return scope.center
  }

  set center(value) {
    const scope = internal(this)
    scope.center = value
    this.uniforms.center.value = (value + 1) / 2
  }
}
