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
  			fragmentShader: shader.fragmentShader
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
      material,
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
