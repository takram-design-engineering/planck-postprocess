// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

import * as Three from 'three'

import 'three/examples/js/postprocessing/EffectComposer'

export default class ShaderPass extends Three.Pass {
  constructor(shader, textureId = 'tDiffuse') {
    super()
    this.textureId = textureId
    if (shader instanceof Three.ShaderMaterial) {
      this.uniforms = shader.uniforms
      this.material = shader.clone()
    } else if (shader) {
      this.uniforms = Three.UniformsUtils.clone(shader.uniforms)
      this.material = new Three.ShaderMaterial({
        defines: shader.defines || {},
        uniforms: this.uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
      })
    }
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
    } = this
    if (this.uniforms[this.textureId]) {
      this.uniforms[this.textureId].value = readBuffer.texture
    }
    if (this.renderToScreen) {
      renderer.render(scene, camera, undefined, this.clear)
    } else {
      renderer.render(scene, camera, writeBuffer, this.clear)
    }
  }
}
