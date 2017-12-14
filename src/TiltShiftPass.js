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

import fragmentShader from './shader/tilt_shift_frag.glsl'
import vertexShader from './shader/tilt_shift_vert.glsl'

export default class TiltShiftPass extends Three.Pass {
  constructor(width = 256, height = 256, pixelRatio = 1, size = 9, {
    radius = 3,
    radiusMax,
    center = 0,
    scale = 1024,
  } = {}) {
    super()
    this.needsSwap = false
    this.uniforms = {
      tDiffuse: { value: null },
      resolution: { value: new Three.Vector2(width, height) },
      direction: { value: new Three.Vector2() },
      radius: { value: radius },
      radiusMax: { value: (radiusMax !== undefined ? radiusMax : radius * 2) },
      center: { value: 0 },
      scale: { value: scale },
    }
    this.material = new Three.ShaderMaterial({
      defines: {
        KERNEL_SIZE: size,
      },
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
    })
    this.camera = new Three.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.scene = new Three.Scene()
    const geometry = new Three.PlaneBufferGeometry(2, 2)
    this.quad = new Three.Mesh(geometry, this.material)
    this.quad.frustumCulled = false
    this.scene.add(this.quad)
  }

  dispose() {
    this.material.dispose()
  }

  render(renderer, writeBuffer, readBuffer, delta, maskActive) {
    const {
      scene,
      camera,
      material,
    } = this
    material.uniforms.tDiffuse.value = readBuffer.texture
    material.uniforms.direction.value.set(1, 0)
    renderer.render(scene, camera, writeBuffer, this.clear)
    material.uniforms.tDiffuse.value = writeBuffer.texture
    material.uniforms.direction.value.set(0, 1)
    if (this.renderToScreen) {
      renderer.render(scene, camera, undefined, this.clear)
    } else {
      renderer.render(scene, camera, readBuffer, this.clear)
    }
  }

  setSize(width, height, pixelRatio = 1) {
    this.uniforms.resolution.value.set(width, height)
  }

  get radius() {
    return this.uniforms.radius.value
  }

  set radius(value) {
    this.uniforms.radius.value = value
  }

  get radiusMax() {
    return this.uniforms.radiusMax.value
  }

  set radiusMax(value) {
    this.uniforms.radiusMax.value = value
  }

  get center() {
    return this.uniforms.center.value
  }

  set center(value) {
    this.uniforms.center.value = value
  }

  get scale() {
    return this.uniforms.scale.value
  }

  set scale(value) {
    this.uniforms.scale.value = value
  }
}
