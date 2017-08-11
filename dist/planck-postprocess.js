(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
	typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
	(factory((global.Planck = global.Planck || {}),global.THREE));
}(this, (function (exports,Three) { 'use strict';

(function (THREE) {
	/**
 * @author alteredq / http://alteredqualia.com/
 */

	THREE.EffectComposer = function (renderer, renderTarget) {

		this.renderer = renderer;

		if (renderTarget === undefined) {

			var parameters = {
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				format: THREE.RGBAFormat,
				stencilBuffer: false
			};

			var size = renderer.getSize();
			renderTarget = new THREE.WebGLRenderTarget(size.width, size.height, parameters);
			renderTarget.texture.name = 'EffectComposer.rt1';
		}

		this.renderTarget1 = renderTarget;
		this.renderTarget2 = renderTarget.clone();
		this.renderTarget2.texture.name = 'EffectComposer.rt2';

		this.writeBuffer = this.renderTarget1;
		this.readBuffer = this.renderTarget2;

		this.passes = [];

		// dependencies

		if (THREE.CopyShader === undefined) {

			console.error('THREE.EffectComposer relies on THREE.CopyShader');
		}

		if (THREE.ShaderPass === undefined) {

			console.error('THREE.EffectComposer relies on THREE.ShaderPass');
		}

		this.copyPass = new THREE.ShaderPass(THREE.CopyShader);
	};

	Object.assign(THREE.EffectComposer.prototype, {

		swapBuffers: function swapBuffers() {

			var tmp = this.readBuffer;
			this.readBuffer = this.writeBuffer;
			this.writeBuffer = tmp;
		},

		addPass: function addPass(pass) {

			this.passes.push(pass);

			var size = this.renderer.getSize();
			pass.setSize(size.width, size.height);
		},

		insertPass: function insertPass(pass, index) {

			this.passes.splice(index, 0, pass);
		},

		render: function render(delta) {

			var maskActive = false;

			var pass,
			    i,
			    il = this.passes.length;

			for (i = 0; i < il; i++) {

				pass = this.passes[i];

				if (pass.enabled === false) continue;

				pass.render(this.renderer, this.writeBuffer, this.readBuffer, delta, maskActive);

				if (pass.needsSwap) {

					if (maskActive) {

						var context = this.renderer.context;

						context.stencilFunc(context.NOTEQUAL, 1, 0xffffffff);

						this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, delta);

						context.stencilFunc(context.EQUAL, 1, 0xffffffff);
					}

					this.swapBuffers();
				}

				if (THREE.MaskPass !== undefined) {

					if (pass instanceof THREE.MaskPass) {

						maskActive = true;
					} else if (pass instanceof THREE.ClearMaskPass) {

						maskActive = false;
					}
				}
			}
		},

		reset: function reset(renderTarget) {

			if (renderTarget === undefined) {

				var size = this.renderer.getSize();

				renderTarget = this.renderTarget1.clone();
				renderTarget.setSize(size.width, size.height);
			}

			this.renderTarget1.dispose();
			this.renderTarget2.dispose();
			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();

			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;
		},

		setSize: function setSize(width, height) {

			this.renderTarget1.setSize(width, height);
			this.renderTarget2.setSize(width, height);

			for (var i = 0; i < this.passes.length; i++) {

				this.passes[i].setSize(width, height);
			}
		}

	});

	THREE.Pass = function () {

		// if set to true, the pass is processed by the composer
		this.enabled = true;

		// if set to true, the pass indicates to swap read and write buffer after rendering
		this.needsSwap = true;

		// if set to true, the pass clears its buffer before rendering
		this.clear = false;

		// if set to true, the result of the pass is rendered to screen
		this.renderToScreen = false;
	};

	Object.assign(THREE.Pass.prototype, {

		setSize: function setSize(width, height) {},

		render: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {

			console.error('THREE.Pass: .render() must be implemented in derived pass.');
		}

	});
})(Three);

(function (THREE) {
		/**
  * @author bhouston / http://clara.io/
  *
  * Luminosity
  * http://en.wikipedia.org/wiki/Luminosity
  */

		THREE.LuminosityHighPassShader = {

				shaderID: "luminosityHighPass",

				uniforms: {

						"tDiffuse": { type: "t", value: null },
						"luminosityThreshold": { type: "f", value: 1.0 },
						"smoothWidth": { type: "f", value: 1.0 },
						"defaultColor": { type: "c", value: new THREE.Color(0x000000) },
						"defaultOpacity": { type: "f", value: 0.0 }

				},

				vertexShader: ["varying vec2 vUv;", "void main() {", "vUv = uv;", "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );", "}"].join("\n"),

				fragmentShader: ["uniform sampler2D tDiffuse;", "uniform vec3 defaultColor;", "uniform float defaultOpacity;", "uniform float luminosityThreshold;", "uniform float smoothWidth;", "varying vec2 vUv;", "void main() {", "vec4 texel = texture2D( tDiffuse, vUv );", "vec3 luma = vec3( 0.299, 0.587, 0.114 );", "float v = dot( texel.xyz, luma );", "vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );", "float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );", "gl_FragColor = mix( outputColor, texel, alpha );", "}"].join("\n")

		};
})(Three);

(function (THREE) {
	/**
 * @author spidersharma / http://eduperiment.com/
 Inspired from Unreal Engine::
 https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */

	THREE.UnrealBloomPass = function (resolution, strength, radius, threshold) {

		THREE.Pass.call(this);

		this.strength = strength !== undefined ? strength : 1;
		this.radius = radius;
		this.threshold = threshold;
		this.resolution = resolution !== undefined ? new THREE.Vector2(resolution.x, resolution.y) : new THREE.Vector2(256, 256);

		// render targets
		var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
		this.renderTargetsHorizontal = [];
		this.renderTargetsVertical = [];
		this.nMips = 5;
		var resx = Math.round(this.resolution.x / 2);
		var resy = Math.round(this.resolution.y / 2);

		this.renderTargetBright = new THREE.WebGLRenderTarget(resx, resy, pars);
		this.renderTargetBright.texture.name = "UnrealBloomPass.bright";
		this.renderTargetBright.texture.generateMipmaps = false;

		for (var i = 0; i < this.nMips; i++) {

			var renderTarget = new THREE.WebGLRenderTarget(resx, resy, pars);

			renderTarget.texture.name = "UnrealBloomPass.h" + i;
			renderTarget.texture.generateMipmaps = false;

			this.renderTargetsHorizontal.push(renderTarget);

			var renderTarget = new THREE.WebGLRenderTarget(resx, resy, pars);

			renderTarget.texture.name = "UnrealBloomPass.v" + i;
			renderTarget.texture.generateMipmaps = false;

			this.renderTargetsVertical.push(renderTarget);

			resx = Math.round(resx / 2);

			resy = Math.round(resy / 2);
		}

		// luminosity high pass material

		if (THREE.LuminosityHighPassShader === undefined) console.error("THREE.UnrealBloomPass relies on THREE.LuminosityHighPassShader");

		var highPassShader = THREE.LuminosityHighPassShader;
		this.highPassUniforms = THREE.UniformsUtils.clone(highPassShader.uniforms);

		this.highPassUniforms["luminosityThreshold"].value = threshold;
		this.highPassUniforms["smoothWidth"].value = 0.01;

		this.materialHighPassFilter = new THREE.ShaderMaterial({
			uniforms: this.highPassUniforms,
			vertexShader: highPassShader.vertexShader,
			fragmentShader: highPassShader.fragmentShader,
			defines: {}
		});

		// Gaussian Blur Materials
		this.separableBlurMaterials = [];
		var kernelSizeArray = [3, 5, 7, 9, 11];
		var resx = Math.round(this.resolution.x / 2);
		var resy = Math.round(this.resolution.y / 2);

		for (var i = 0; i < this.nMips; i++) {

			this.separableBlurMaterials.push(this.getSeperableBlurMaterial(kernelSizeArray[i]));

			this.separableBlurMaterials[i].uniforms["texSize"].value = new THREE.Vector2(resx, resy);

			resx = Math.round(resx / 2);

			resy = Math.round(resy / 2);
		}

		// Composite material
		this.compositeMaterial = this.getCompositeMaterial(this.nMips);
		this.compositeMaterial.uniforms["blurTexture1"].value = this.renderTargetsVertical[0].texture;
		this.compositeMaterial.uniforms["blurTexture2"].value = this.renderTargetsVertical[1].texture;
		this.compositeMaterial.uniforms["blurTexture3"].value = this.renderTargetsVertical[2].texture;
		this.compositeMaterial.uniforms["blurTexture4"].value = this.renderTargetsVertical[3].texture;
		this.compositeMaterial.uniforms["blurTexture5"].value = this.renderTargetsVertical[4].texture;
		this.compositeMaterial.uniforms["bloomStrength"].value = strength;
		this.compositeMaterial.uniforms["bloomRadius"].value = 0.1;
		this.compositeMaterial.needsUpdate = true;

		var bloomFactors = [1.0, 0.8, 0.6, 0.4, 0.2];
		this.compositeMaterial.uniforms["bloomFactors"].value = bloomFactors;
		this.bloomTintColors = [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)];
		this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;

		// copy material
		if (THREE.CopyShader === undefined) console.error("THREE.BloomPass relies on THREE.CopyShader");

		var copyShader = THREE.CopyShader;

		this.copyUniforms = THREE.UniformsUtils.clone(copyShader.uniforms);
		this.copyUniforms["opacity"].value = 1.0;

		this.materialCopy = new THREE.ShaderMaterial({
			uniforms: this.copyUniforms,
			vertexShader: copyShader.vertexShader,
			fragmentShader: copyShader.fragmentShader,
			blending: THREE.AdditiveBlending,
			depthTest: false,
			depthWrite: false,
			transparent: true
		});

		this.enabled = true;
		this.needsSwap = false;

		this.oldClearColor = new THREE.Color();
		this.oldClearAlpha = 1;

		this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this.scene = new THREE.Scene();

		this.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
		this.quad.frustumCulled = false; // Avoid getting clipped
		this.scene.add(this.quad);
	};

	THREE.UnrealBloomPass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {

		constructor: THREE.UnrealBloomPass,

		dispose: function dispose() {
			for (var i = 0; i < this.renderTargetsHorizontal.length(); i++) {
				this.renderTargetsHorizontal[i].dispose();
			}
			for (var i = 0; i < this.renderTargetsVertical.length(); i++) {
				this.renderTargetsVertical[i].dispose();
			}
			this.renderTargetBright.dispose();
		},

		setSize: function setSize(width, height) {

			var resx = Math.round(width / 2);
			var resy = Math.round(height / 2);

			this.renderTargetBright.setSize(resx, resy);

			for (var i = 0; i < this.nMips; i++) {

				this.renderTargetsHorizontal[i].setSize(resx, resy);
				this.renderTargetsVertical[i].setSize(resx, resy);

				this.separableBlurMaterials[i].uniforms["texSize"].value = new THREE.Vector2(resx, resy);

				resx = Math.round(resx / 2);
				resy = Math.round(resy / 2);
			}
		},

		render: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {

			this.oldClearColor.copy(renderer.getClearColor());
			this.oldClearAlpha = renderer.getClearAlpha();
			var oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;

			renderer.setClearColor(new THREE.Color(0, 0, 0), 0);

			if (maskActive) renderer.context.disable(renderer.context.STENCIL_TEST);

			// 1. Extract Bright Areas
			this.highPassUniforms["tDiffuse"].value = readBuffer.texture;
			this.highPassUniforms["luminosityThreshold"].value = this.threshold;
			this.quad.material = this.materialHighPassFilter;
			renderer.render(this.scene, this.camera, this.renderTargetBright, true);

			// 2. Blur All the mips progressively
			var inputRenderTarget = this.renderTargetBright;

			for (var i = 0; i < this.nMips; i++) {

				this.quad.material = this.separableBlurMaterials[i];

				this.separableBlurMaterials[i].uniforms["colorTexture"].value = inputRenderTarget.texture;

				this.separableBlurMaterials[i].uniforms["direction"].value = THREE.UnrealBloomPass.BlurDirectionX;

				renderer.render(this.scene, this.camera, this.renderTargetsHorizontal[i], true);

				this.separableBlurMaterials[i].uniforms["colorTexture"].value = this.renderTargetsHorizontal[i].texture;

				this.separableBlurMaterials[i].uniforms["direction"].value = THREE.UnrealBloomPass.BlurDirectionY;

				renderer.render(this.scene, this.camera, this.renderTargetsVertical[i], true);

				inputRenderTarget = this.renderTargetsVertical[i];
			}

			// Composite All the mips
			this.quad.material = this.compositeMaterial;
			this.compositeMaterial.uniforms["bloomStrength"].value = this.strength;
			this.compositeMaterial.uniforms["bloomRadius"].value = this.radius;
			this.compositeMaterial.uniforms["bloomTintColors"].value = this.bloomTintColors;
			renderer.render(this.scene, this.camera, this.renderTargetsHorizontal[0], true);

			// Blend it additively over the input texture
			this.quad.material = this.materialCopy;
			this.copyUniforms["tDiffuse"].value = this.renderTargetsHorizontal[0].texture;

			if (maskActive) renderer.context.enable(renderer.context.STENCIL_TEST);

			renderer.render(this.scene, this.camera, readBuffer, false);

			renderer.setClearColor(this.oldClearColor, this.oldClearAlpha);
			renderer.autoClear = oldAutoClear;
		},

		getSeperableBlurMaterial: function getSeperableBlurMaterial(kernelRadius) {

			return new THREE.ShaderMaterial({

				defines: {
					"KERNEL_RADIUS": kernelRadius,
					"SIGMA": kernelRadius
				},

				uniforms: {
					"colorTexture": { value: null },
					"texSize": { value: new THREE.Vector2(0.5, 0.5) },
					"direction": { value: new THREE.Vector2(0.5, 0.5) }
				},

				vertexShader: "varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

				fragmentShader: "#include <common>\
				varying vec2 vUv;\n\
				uniform sampler2D colorTexture;\n\
				uniform vec2 texSize;\
				uniform vec2 direction;\
				\
				float gaussianPdf(in float x, in float sigma) {\
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;\
				}\
				void main() {\n\
					vec2 invSize = 1.0 / texSize;\
					float fSigma = float(SIGMA);\
					float weightSum = gaussianPdf(0.0, fSigma);\
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;\
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {\
						float x = float(i);\
						float w = gaussianPdf(x, fSigma);\
						vec2 uvOffset = direction * invSize * x;\
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;\
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;\
						diffuseSum += (sample1 + sample2) * w;\
						weightSum += 2.0 * w;\
					}\
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);\n\
				}"
			});
		},

		getCompositeMaterial: function getCompositeMaterial(nMips) {

			return new THREE.ShaderMaterial({

				defines: {
					"NUM_MIPS": nMips
				},

				uniforms: {
					"blurTexture1": { value: null },
					"blurTexture2": { value: null },
					"blurTexture3": { value: null },
					"blurTexture4": { value: null },
					"blurTexture5": { value: null },
					"dirtTexture": { value: null },
					"bloomStrength": { value: 1.0 },
					"bloomFactors": { value: null },
					"bloomTintColors": { value: null },
					"bloomRadius": { value: 0.0 }
				},

				vertexShader: "varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

				fragmentShader: "varying vec2 vUv;\
				uniform sampler2D blurTexture1;\
				uniform sampler2D blurTexture2;\
				uniform sampler2D blurTexture3;\
				uniform sampler2D blurTexture4;\
				uniform sampler2D blurTexture5;\
				uniform sampler2D dirtTexture;\
				uniform float bloomStrength;\
				uniform float bloomRadius;\
				uniform float bloomFactors[NUM_MIPS];\
				uniform vec3 bloomTintColors[NUM_MIPS];\
				\
				float lerpBloomFactor(const in float factor) { \
					float mirrorFactor = 1.2 - factor;\
					return mix(factor, mirrorFactor, bloomRadius);\
				}\
				\
				void main() {\
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) + \
					 							 lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) + \
												 lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) + \
												 lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) + \
												 lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );\
				}"
			});
		}

	});

	THREE.UnrealBloomPass.BlurDirectionX = new THREE.Vector2(1.0, 0.0);
	THREE.UnrealBloomPass.BlurDirectionY = new THREE.Vector2(0.0, 1.0);
})(Three);

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};



















var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

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

var BloomPass = function (_Three$UnrealBloomPas) {
  inherits(BloomPass, _Three$UnrealBloomPas);

  function BloomPass(width, height) {
    var _ref;

    classCallCheck(this, BloomPass);

    for (var _len = arguments.length, rest = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      rest[_key - 2] = arguments[_key];
    }

    // Parameters
    var _this = possibleConstructorReturn(this, (_ref = BloomPass.__proto__ || Object.getPrototypeOf(BloomPass)).call.apply(_ref, [this, new Three.Vector2(width, height)].concat(rest)));

    _this.readBuffer = null;
    _this.needsSeparateRender = false;
    _this.layers = new Three.Layers();
    _this.layers.set(1);
    return _this;
  }

  createClass(BloomPass, [{
    key: 'render',
    value: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {
      this.oldClearColor.copy(renderer.getClearColor());
      this.oldClearAlpha = renderer.getClearAlpha();
      var oldAutoClear = renderer.autoClear;
      // eslint-disable-next-line no-param-reassign
      renderer.autoClear = false;
      renderer.setClearColor(new Three.Color(0, 0, 0), 0);
      if (maskActive) {
        renderer.context.disable(renderer.context.STENCIL_TEST);
      }

      // 1. Extract Bright Areas
      if (this.needsSeparateRender) {
        this.highPassUniforms.tDiffuse.value = this.readBuffer.texture;
      } else {
        this.highPassUniforms.tDiffuse.value = readBuffer.texture;
      }
      this.highPassUniforms.luminosityThreshold.value = this.threshold;
      this.quad.material = this.materialHighPassFilter;
      renderer.render(this.scene, this.camera, this.renderTargetBright, true);

      // 2. Blur All the mips progressively
      var inputRenderTarget = this.renderTargetBright;
      for (var i = 0; i < this.nMips; ++i) {
        var material = this.separableBlurMaterials[i];
        var _horizontal = this.renderTargetsHorizontal[i];
        var vertical = this.renderTargetsVertical[i];
        this.quad.material = material;
        material.uniforms.colorTexture.value = inputRenderTarget.texture;
        material.uniforms.direction.value = Three.UnrealBloomPass.BlurDirectionX;
        renderer.render(this.scene, this.camera, _horizontal, true);
        material.uniforms.colorTexture.value = _horizontal.texture;
        material.uniforms.direction.value = Three.UnrealBloomPass.BlurDirectionY;
        renderer.render(this.scene, this.camera, vertical, true);
        inputRenderTarget = vertical;
      }

      // Composite All the mips
      var horizontal = this.renderTargetsHorizontal[0];
      this.quad.material = this.compositeMaterial;
      this.compositeMaterial.uniforms.bloomStrength.value = this.strength;
      this.compositeMaterial.uniforms.bloomRadius.value = this.radius;
      this.compositeMaterial.uniforms.bloomTintColors.value = this.bloomTintColors;
      renderer.render(this.scene, this.camera, horizontal, true);

      // Blend it additively over the input texture
      this.quad.material = this.materialCopy;
      this.copyUniforms.tDiffuse.value = horizontal.texture;

      if (maskActive) {
        renderer.context.enable(renderer.context.STENCIL_TEST);
      }
      renderer.render(this.scene, this.camera, readBuffer, false);
      renderer.setClearColor(this.oldClearColor, this.oldClearAlpha);
      // eslint-disable-next-line no-param-reassign
      renderer.autoClear = oldAutoClear;
    }
  }]);
  return BloomPass;
}(Three.UnrealBloomPass);

function template(str, locals) {
  return template.compile(str).call(this, locals);
}

template.compile = function (str) {
  var es6TemplateRegex = /(\\)?\$\{([^\{\}\\]+)\}/g;

  if (typeof str !== 'string') {
    throw new Error('The first argument must be a template string');
  }

  return function (locals) {
    return str.replace(es6TemplateRegex, function (matched) {
      return parse(matched).call(locals || {});
    });
  };
};

function parse(variable) {
  var __variable = variable.match(/\{(.*)\}/);

  if (variable[0] === '\\') {
    return function () {
      return variable.slice(1);
    };
  }
  return function () {
    var declare = '';

    for (var key in this) {
      if (this.hasOwnProperty(key)) {
        declare += 'var ' + key + '=' + JSON.stringify(this[key]) + ';';
      }
    }
    return Function(declare + 'return ' + __variable[1])();
  };
}

var index = template.render = template;

(function (THREE) {
	/**
 * @author alteredq / http://alteredqualia.com/
 */

	THREE.ShaderPass = function (shader, textureID) {

		THREE.Pass.call(this);

		this.textureID = textureID !== undefined ? textureID : "tDiffuse";

		if (shader instanceof THREE.ShaderMaterial) {

			this.uniforms = shader.uniforms;

			this.material = shader;
		} else if (shader) {

			this.uniforms = THREE.UniformsUtils.clone(shader.uniforms);

			this.material = new THREE.ShaderMaterial({

				defines: shader.defines || {},
				uniforms: this.uniforms,
				vertexShader: shader.vertexShader,
				fragmentShader: shader.fragmentShader

			});
		}

		this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this.scene = new THREE.Scene();

		this.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
		this.quad.frustumCulled = false; // Avoid getting clipped
		this.scene.add(this.quad);
	};

	THREE.ShaderPass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {

		constructor: THREE.ShaderPass,

		render: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {

			if (this.uniforms[this.textureID]) {

				this.uniforms[this.textureID].value = readBuffer.texture;
			}

			this.quad.material = this.material;

			if (this.renderToScreen) {

				renderer.render(this.scene, this.camera);
			} else {

				renderer.render(this.scene, this.camera, writeBuffer, this.clear);
			}
		}

	});
})(Three);

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

function Namespace() {
  var name = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : undefined;

  var symbol = Symbol(name);
  return function namespace(object) {
    var init = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function (data) {
      return data;
    };

    if (object[symbol] === undefined) {
      // eslint-disable-next-line no-param-reassign
      object[symbol] = init({});
    }
    return object[symbol];
  };
}

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

var internal = Namespace('BlurPass');

var BlurPass = function (_Three$ShaderPass) {
  inherits(BlurPass, _Three$ShaderPass);

  function BlurPass(shader) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$amount = _ref.amount,
        amount = _ref$amount === undefined ? 9 : _ref$amount;

    classCallCheck(this, BlurPass);

    var _this = possibleConstructorReturn(this, (BlurPass.__proto__ || Object.getPrototypeOf(BlurPass)).call(this, shader));

    var scope = internal(_this);
    scope.denominator = 1000;
    scope.amount = amount;
    return _this;
  }

  createClass(BlurPass, [{
    key: 'setSize',
    value: function setSize(width, height) {
      this.denominator = 1000 * width / height;
    }
  }, {
    key: 'denominator',
    get: function get$$1() {
      var scope = internal(this);
      return scope.denominator;
    },
    set: function set$$1(value) {
      var scope = internal(this);
      scope.denominator = value;
      this.uniforms.amount.value = this.amount / value;
    }
  }, {
    key: 'amount',
    get: function get$$1() {
      var scope = internal(this);
      return scope.amount;
    },
    set: function set$$1(value) {
      var scope = internal(this);
      scope.amount = value;
      this.uniforms.amount.value = value / this.denominator;
    }
  }]);
  return BlurPass;
}(Three.ShaderPass);

var fragmentShader = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\n#ifndef KERNEL_SIZE\n  #define KERNEL_SIZE ${size}\n#endif\n\nuniform sampler2D tDiffuse;\nuniform float amount;\n\nvarying vec2 vUv;\n\nvoid main() {\n  vec4 color = vec4(0.0);\n\n  #if (KERNEL_SIZE == 9)\n    color += texture2D(tDiffuse, vec2(vUv.x - 4.0 * amount, vUv.y)) * 0.0548925;\n    color += texture2D(tDiffuse, vec2(vUv.x - 3.0 * amount, vUv.y)) * 0.08824;\n    color += texture2D(tDiffuse, vec2(vUv.x - 2.0 * amount, vUv.y)) * 0.123853;\n    color += texture2D(tDiffuse, vec2(vUv.x - 1.0 * amount, vUv.y)) * 0.151793;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.162443;\n    color += texture2D(tDiffuse, vec2(vUv.x + 1.0 * amount, vUv.y)) * 0.151793;\n    color += texture2D(tDiffuse, vec2(vUv.x + 2.0 * amount, vUv.y)) * 0.123853;\n    color += texture2D(tDiffuse, vec2(vUv.x + 3.0 * amount, vUv.y)) * 0.08824;\n    color += texture2D(tDiffuse, vec2(vUv.x + 4.0 * amount, vUv.y)) * 0.0548925;\n  #endif\n\n  #if (KERNEL_SIZE == 7)\n    color += texture2D(tDiffuse, vec2(vUv.x - 3.0 * amount, vUv.y)) * 0.099122;\n    color += texture2D(tDiffuse, vec2(vUv.x - 2.0 * amount, vUv.y)) * 0.139127;\n    color += texture2D(tDiffuse, vec2(vUv.x - 1.0 * amount, vUv.y)) * 0.170513;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.182476;\n    color += texture2D(tDiffuse, vec2(vUv.x + 1.0 * amount, vUv.y)) * 0.170513;\n    color += texture2D(tDiffuse, vec2(vUv.x + 2.0 * amount, vUv.y)) * 0.139127;\n    color += texture2D(tDiffuse, vec2(vUv.x + 3.0 * amount, vUv.y)) * 0.099122;\n  #endif\n\n  #if (KERNEL_SIZE == 5)\n    color += texture2D(tDiffuse, vec2(vUv.x - 2.0 * amount, vUv.y)) * 0.1735285;\n    color += texture2D(tDiffuse, vec2(vUv.x - 1.0 * amount, vUv.y)) * 0.212674;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.227595;\n    color += texture2D(tDiffuse, vec2(vUv.x + 1.0 * amount, vUv.y)) * 0.212674;\n    color += texture2D(tDiffuse, vec2(vUv.x + 2.0 * amount, vUv.y)) * 0.1735285;\n  #endif\n\n  gl_FragColor = color;\n}\n";

var vertexShader = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

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

var BlurHorizontalPass = function (_BlurPass) {
  inherits(BlurHorizontalPass, _BlurPass);

  function BlurHorizontalPass() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$size = _ref.size,
        size = _ref$size === undefined ? 9 : _ref$size,
        _ref$amount = _ref.amount,
        amount = _ref$amount === undefined ? 9 : _ref$amount;

    classCallCheck(this, BlurHorizontalPass);

    var uniforms = {
      tDiffuse: { value: null },
      amount: { value: 1 / 512 }
    };
    var shader = {
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: index(fragmentShader, { size: size })
    };
    return possibleConstructorReturn(this, (BlurHorizontalPass.__proto__ || Object.getPrototypeOf(BlurHorizontalPass)).call(this, shader, { amount: amount }));
  }

  return BlurHorizontalPass;
}(BlurPass);

var fragmentShader$1 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\n#ifndef KERNEL_SIZE\n  #define KERNEL_SIZE ${size}\n#endif\n\nuniform sampler2D tDiffuse;\nuniform float amount;\n\nvarying vec2 vUv;\n\nvoid main() {\n  vec4 color = vec4(0.0);\n\n  #if (KERNEL_SIZE == 9)\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 4.0 * amount)) * 0.0548925;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 3.0 * amount)) * 0.08824;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * amount)) * 0.123853;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * amount)) * 0.151793;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.162443;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * amount)) * 0.151793;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * amount)) * 0.123853;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 3.0 * amount)) * 0.08824;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 4.0 * amount)) * 0.0548925;\n  #endif\n\n  #if (KERNEL_SIZE == 7)\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 3.0 * amount)) * 0.099122;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * amount)) * 0.139127;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * amount)) * 0.170513;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.182476;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * amount)) * 0.170513;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * amount)) * 0.139127;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 3.0 * amount)) * 0.099122;\n  #endif\n\n  #if (KERNEL_SIZE == 5)\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * amount)) * 0.1735285;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * amount)) * 0.212674;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.227595;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * amount)) * 0.212674;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * amount)) * 0.1735285;\n  #endif\n\n  gl_FragColor = color;\n}\n";

var vertexShader$1 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

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

var BlurVerticalPass = function (_BlurPass) {
  inherits(BlurVerticalPass, _BlurPass);

  function BlurVerticalPass() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$size = _ref.size,
        size = _ref$size === undefined ? 9 : _ref$size,
        _ref$amount = _ref.amount,
        amount = _ref$amount === undefined ? 9 : _ref$amount;

    classCallCheck(this, BlurVerticalPass);

    var uniforms = {
      tDiffuse: { value: null },
      amount: { value: 1 / 512 }
    };
    var shader = {
      uniforms: uniforms,
      vertexShader: vertexShader$1,
      fragmentShader: index(fragmentShader$1, { size: size })
    };
    return possibleConstructorReturn(this, (BlurVerticalPass.__proto__ || Object.getPrototypeOf(BlurVerticalPass)).call(this, shader, { amount: amount }));
  }

  return BlurVerticalPass;
}(BlurPass);

var fragmentShader$2 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nuniform sampler2D tDiffuse1;\nuniform sampler2D tDiffuse2;\nuniform float center;\n\nvarying vec2 vUv;\n\nvoid main() {\n  vec4 texel1 = texture2D(tDiffuse1, vUv);\n  vec4 texel2 = texture2D(tDiffuse2, vUv);\n  gl_FragColor = vec4(texel2.a) * texel2 + vec4(1.0 - texel2.a) * texel1;\n}\n";

var vertexShader$2 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

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

var ComposePass = function (_Three$ShaderPass) {
  inherits(ComposePass, _Three$ShaderPass);

  function ComposePass() {
    classCallCheck(this, ComposePass);

    var uniforms = {
      tDiffuse1: { value: null },
      tDiffuse2: { value: null }
    };
    var shader = { uniforms: uniforms, vertexShader: vertexShader$2, fragmentShader: fragmentShader$2 };
    return possibleConstructorReturn(this, (ComposePass.__proto__ || Object.getPrototypeOf(ComposePass)).call(this, shader));
  }

  return ComposePass;
}(Three.ShaderPass);

(function (THREE) {
	/**
 * @author alteredq / http://alteredqualia.com/
 * @author davidedc / http://www.sketchpatch.net/
 *
 * NVIDIA FXAA by Timothy Lottes
 * http://timothylottes.blogspot.com/2011/06/fxaa3-source-released.html
 * - WebGL port by @supereggbert
 * http://www.glge.org/demos/fxaa/
 */

	THREE.FXAAShader = {

		uniforms: {

			"tDiffuse": { value: null },
			"resolution": { value: new THREE.Vector2(1 / 1024, 1 / 512) }

		},

		vertexShader: ["void main() {", "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );", "}"].join("\n"),

		fragmentShader: ["uniform sampler2D tDiffuse;", "uniform vec2 resolution;", "#define FXAA_REDUCE_MIN   (1.0/128.0)", "#define FXAA_REDUCE_MUL   (1.0/8.0)", "#define FXAA_SPAN_MAX     8.0", "void main() {", "vec3 rgbNW = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( -1.0, -1.0 ) ) * resolution ).xyz;", "vec3 rgbNE = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( 1.0, -1.0 ) ) * resolution ).xyz;", "vec3 rgbSW = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( -1.0, 1.0 ) ) * resolution ).xyz;", "vec3 rgbSE = texture2D( tDiffuse, ( gl_FragCoord.xy + vec2( 1.0, 1.0 ) ) * resolution ).xyz;", "vec4 rgbaM  = texture2D( tDiffuse,  gl_FragCoord.xy  * resolution );", "vec3 rgbM  = rgbaM.xyz;", "vec3 luma = vec3( 0.299, 0.587, 0.114 );", "float lumaNW = dot( rgbNW, luma );", "float lumaNE = dot( rgbNE, luma );", "float lumaSW = dot( rgbSW, luma );", "float lumaSE = dot( rgbSE, luma );", "float lumaM  = dot( rgbM,  luma );", "float lumaMin = min( lumaM, min( min( lumaNW, lumaNE ), min( lumaSW, lumaSE ) ) );", "float lumaMax = max( lumaM, max( max( lumaNW, lumaNE) , max( lumaSW, lumaSE ) ) );", "vec2 dir;", "dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));", "dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));", "float dirReduce = max( ( lumaNW + lumaNE + lumaSW + lumaSE ) * ( 0.25 * FXAA_REDUCE_MUL ), FXAA_REDUCE_MIN );", "float rcpDirMin = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + dirReduce );", "dir = min( vec2( FXAA_SPAN_MAX,  FXAA_SPAN_MAX),", "max( vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),", "dir * rcpDirMin)) * resolution;", "vec4 rgbA = (1.0/2.0) * (", "texture2D(tDiffuse,  gl_FragCoord.xy  * resolution + dir * (1.0/3.0 - 0.5)) +", "texture2D(tDiffuse,  gl_FragCoord.xy  * resolution + dir * (2.0/3.0 - 0.5)));", "vec4 rgbB = rgbA * (1.0/2.0) + (1.0/4.0) * (", "texture2D(tDiffuse,  gl_FragCoord.xy  * resolution + dir * (0.0/3.0 - 0.5)) +", "texture2D(tDiffuse,  gl_FragCoord.xy  * resolution + dir * (3.0/3.0 - 0.5)));", "float lumaB = dot(rgbB, vec4(luma, 0.0));", "if ( ( lumaB < lumaMin ) || ( lumaB > lumaMax ) ) {", "gl_FragColor = rgbA;", "} else {", "gl_FragColor = rgbB;", "}", "}"].join("\n")

	};
})(Three);

var fragmentShader$3 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\n#define FXAA_GLSL_100 1\n#define FXAA_QUALITY_PRESET ${quality}\n\n${fxaaShader}\n\nuniform sampler2D tDiffuse;\nuniform vec2 resolution;\n\nvarying vec2 vUv;\n\nvoid main() {\n  gl_FragColor = FxaaPixelShader(\n    vUv,\n    tDiffuse,\n    resolution,\n    ${subpix.toPrecision(10)},\n    ${edgeThreshold.toPrecision(10)},\n    ${edgeThresholdMin.toPrecision(10)}\n  );\n  gl_FragColor.a = 1.0;\n}\n";

var fxaaShader = "#define GLSLIFY 1\n//\n//  File:        es3-kepler\\FXAA/FXAA3_11.h\n//  SDK Version: v3.00\n//  Email:       gameworks@nvidia.com\n//  Site:        http://developer.nvidia.com/\n//\n//  Copyright (c) 2014-2015, NVIDIA CORPORATION. All rights reserved.\n//\n//  Redistribution and use in source and binary forms, with or without\n//  modification, are permitted provided that the following conditions\n//  are met:\n//   * Redistributions of source code must retain the above copyright\n//     notice, this list of conditions and the following disclaimer.\n//   * Redistributions in binary form must reproduce the above copyright\n//     notice, this list of conditions and the following disclaimer in the\n//     documentation and/or other materials provided with the distribution.\n//   * Neither the name of NVIDIA CORPORATION nor the names of its\n//     contributors may be used to endorse or promote products derived\n//     from this software without specific prior written permission.\n//\n//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ``AS IS'' AND ANY\n//  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE\n//  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR\n//  PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR\n//  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,\n//  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,\n//  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR\n//  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY\n//  OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT\n//  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE\n//  OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\n//\n\n#ifndef FXAA_GLSL_100\n  #define FXAA_GLSL_100 0\n#endif\n\n#ifndef FXAA_GLSL_120\n  #define FXAA_GLSL_120 0\n#endif\n\n#ifndef FXAA_GLSL_130\n  #define FXAA_GLSL_130 0\n#endif\n\n#ifndef FXAA_HLSL_3\n  #define FXAA_HLSL_3 0\n#endif\n\n#ifndef FXAA_HLSL_4\n  #define FXAA_HLSL_4 0\n#endif\n\n#ifndef FXAA_HLSL_5\n  #define FXAA_HLSL_5 0\n#endif\n\n// -----------------------------------------------------------------------------\n\n// For those using non-linear color, and either not able to get luma in alpha,\n// or not wanting to, this enables FXAA to run using green as a proxy for luma.\n// So with this enabled, no need to pack luma in alpha.\n//\n// This will turn off AA on anything which lacks some amount of green. Pure red\n// and blue or combination of only R and B, will get no AA.\n//\n// Might want to lower the settings for both,\n//   fxaaConsoleEdgeThresholdMin\n//   fxaaQualityEdgeThresholdMin\n// In order to insure AA does not get turned off on colors which contain a minor\n// amount of green.\n//\n// 1 = On\n// 0 = Off\n#ifndef FXAA_GREEN_AS_LUMA\n  #define FXAA_GREEN_AS_LUMA 0\n#endif\n\n// Probably will not work when FXAA_GREEN_AS_LUMA = 1.\n// 1 = Use discard on pixels which don't need AA. For APIs which enable\n//     concurrent TEX+ROP from same surface.\n// 0 = Return unchanged color on pixels which don't need AA.\n#ifndef FXAA_DISCARD\n  #define FXAA_DISCARD 0\n#endif\n\n// Used for GLSL 120 only.\n//\n// 1 = GL API supports fast pixel offsets\n// 0 = do not use fast pixel offsets\n#ifndef FXAA_FAST_PIXEL_OFFSET\n  #ifdef GL_EXT_gpu_shader4\n    #define FXAA_FAST_PIXEL_OFFSET 1\n  #endif\n  #ifdef GL_NV_gpu_shader5\n    #define FXAA_FAST_PIXEL_OFFSET 1\n  #endif\n  #ifdef GL_ARB_gpu_shader5\n    #define FXAA_FAST_PIXEL_OFFSET 1\n  #endif\n  #ifndef FXAA_FAST_PIXEL_OFFSET\n    #define FXAA_FAST_PIXEL_OFFSET 0\n  #endif\n#endif\n\n// 1 = API supports gather4 on alpha channel.\n// 0 = API does not support gather4 on alpha channel.\n#ifndef FXAA_GATHER4_ALPHA\n  #if (FXAA_HLSL_5 == 1)\n    #define FXAA_GATHER4_ALPHA 1\n  #endif\n  #ifdef GL_ARB_gpu_shader5\n    #define FXAA_GATHER4_ALPHA 1\n  #endif\n  #ifdef GL_NV_gpu_shader5\n    #define FXAA_GATHER4_ALPHA 1\n  #endif\n  #ifndef FXAA_GATHER4_ALPHA\n    #define FXAA_GATHER4_ALPHA 0\n  #endif\n#endif\n\n// -----------------------------------------------------------------------------\n//  FXAA QUALITY - TUNING KNOBS\n// -----------------------------------------------------------------------------\n\n// Choose the quality preset. This needs to be compiled into the shader as it\n// effects code. Best option to include multiple presets is to in each shader\n// define the preset, then include this file.\n//\n// OPTIONS\n// 10 to 15 - default medium dither (10 = fastest, 15 = highest quality)\n// 20 to 29 - less dither, more expensive (20 = fastest, 29 = highest quality)\n// 39       - no dither, very expensive\n//\n// NOTES\n// 12 = slightly faster then FXAA 3.9 and higher edge quality (default)\n// 13 = about same speed as FXAA 3.9 and better than 12\n// 23 = closest to FXAA 3.9 visually and performance wise\n//  _ = the lowest digit is directly related to performance\n// _  = the highest digit is directly related to style\n#ifndef FXAA_QUALITY_PRESET\n  #define FXAA_QUALITY_PRESET 12\n#endif\n\n// -----------------------------------------------------------------------------\n//  FXAA QUALITY - PRESETS\n\n// -----------------------------------------------------------------------------\n//  FXAA QUALITY - MEDIUM DITHER PRESETS\n\n#if (FXAA_QUALITY_PRESET == 10)\n  #define FXAA_QUALITY_PS 3\n  #define FXAA_QUALITY_P0 1.5\n  #define FXAA_QUALITY_P1 3.0\n  #define FXAA_QUALITY_P2 12.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 11)\n  #define FXAA_QUALITY_PS 4\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 3.0\n  #define FXAA_QUALITY_P3 12.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 12)\n  #define FXAA_QUALITY_PS 5\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 4.0\n  #define FXAA_QUALITY_P4 12.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 13)\n  #define FXAA_QUALITY_PS 6\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 4.0\n  #define FXAA_QUALITY_P5 12.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 14)\n  #define FXAA_QUALITY_PS 7\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 4.0\n  #define FXAA_QUALITY_P6 12.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 15)\n  #define FXAA_QUALITY_PS 8\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 4.0\n  #define FXAA_QUALITY_P7 12.0\n#endif\n\n// -----------------------------------------------------------------------------\n//  FXAA QUALITY - LOW DITHER PRESETS\n\n#if (FXAA_QUALITY_PRESET == 20)\n  #define FXAA_QUALITY_PS 3\n  #define FXAA_QUALITY_P0 1.5\n  #define FXAA_QUALITY_P1 2.0\n  #define FXAA_QUALITY_P2 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 21)\n  #define FXAA_QUALITY_PS 4\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 22)\n  #define FXAA_QUALITY_PS 5\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 23)\n  #define FXAA_QUALITY_PS 6\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 24)\n  #define FXAA_QUALITY_PS 7\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 3.0\n  #define FXAA_QUALITY_P6 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 25)\n  #define FXAA_QUALITY_PS 8\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 4.0\n  #define FXAA_QUALITY_P7 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 26)\n  #define FXAA_QUALITY_PS 9\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 2.0\n  #define FXAA_QUALITY_P7 4.0\n  #define FXAA_QUALITY_P8 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 27)\n  #define FXAA_QUALITY_PS 10\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 2.0\n  #define FXAA_QUALITY_P7 2.0\n  #define FXAA_QUALITY_P8 4.0\n  #define FXAA_QUALITY_P9 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 28)\n  #define FXAA_QUALITY_PS 11\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 2.0\n  #define FXAA_QUALITY_P7 2.0\n  #define FXAA_QUALITY_P8 2.0\n  #define FXAA_QUALITY_P9 4.0\n  #define FXAA_QUALITY_P10 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 29)\n  #define FXAA_QUALITY_PS 12\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 2.0\n  #define FXAA_QUALITY_P7 2.0\n  #define FXAA_QUALITY_P8 2.0\n  #define FXAA_QUALITY_P9 2.0\n  #define FXAA_QUALITY_P10 4.0\n  #define FXAA_QUALITY_P11 8.0\n#endif\n\n// -----------------------------------------------------------------------------\n//  FXAA QUALITY - EXTREME QUALITY\n\n#if (FXAA_QUALITY_PRESET == 39)\n  #define FXAA_QUALITY_PS 12\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.0\n  #define FXAA_QUALITY_P2 1.0\n  #define FXAA_QUALITY_P3 1.0\n  #define FXAA_QUALITY_P4 1.0\n  #define FXAA_QUALITY_P5 1.5\n  #define FXAA_QUALITY_P6 2.0\n  #define FXAA_QUALITY_P7 2.0\n  #define FXAA_QUALITY_P8 2.0\n  #define FXAA_QUALITY_P9 2.0\n  #define FXAA_QUALITY_P10 4.0\n  #define FXAA_QUALITY_P11 8.0\n#endif\n\n// -----------------------------------------------------------------------------\n//  API PORTING\n\n#if (FXAA_GLSL_100 == 1) || (FXAA_GLSL_120 == 1) || (FXAA_GLSL_130 == 1)\n  #define FxaaBool bool\n  #define FxaaDiscard discard\n  #define FxaaFloat float\n  #define FxaaFloat2 vec2\n  #define FxaaFloat3 vec3\n  #define FxaaFloat4 vec4\n  #define FxaaHalf float\n  #define FxaaHalf2 vec2\n  #define FxaaHalf3 vec3\n  #define FxaaHalf4 vec4\n  #define FxaaInt2 ivec2\n  #define FxaaSat(x) clamp(x, 0.0, 1.0)\n  #define FxaaTex sampler2D\n#else\n  #define FxaaBool bool\n  #define FxaaDiscard clip(-1)\n  #define FxaaFloat float\n  #define FxaaFloat2 float2\n  #define FxaaFloat3 float3\n  #define FxaaFloat4 float4\n  #define FxaaHalf half\n  #define FxaaHalf2 half2\n  #define FxaaHalf3 half3\n  #define FxaaHalf4 half4\n  #define FxaaSat(x) saturate(x)\n#endif\n\n// -----------------------------------------------------------------------------\n\n#if (FXAA_GLSL_100 == 1)\n  #define FxaaTexTop(t, p) texture2D(t, p, 0.0)\n  #define FxaaTexOff(t, p, o, r) texture2D(t, p + (o * r), 0.0)\n#endif\n\n// -----------------------------------------------------------------------------\n\n#if (FXAA_GLSL_120 == 1)\n  // Requires,\n  //  #version 120\n  // And at least,\n  //  #extension GL_EXT_gpu_shader4 : enable\n  //  (or set FXAA_FAST_PIXEL_OFFSET 1 to work like DX9)\n  #define FxaaTexTop(t, p) texture2DLod(t, p, 0.0)\n  #if (FXAA_FAST_PIXEL_OFFSET == 1)\n    #define FxaaTexOff(t, p, o, r) texture2DLodOffset(t, p, 0.0, o)\n  #else\n    #define FxaaTexOff(t, p, o, r) texture2DLod(t, p + (o * r), 0.0)\n  #endif\n  #if (FXAA_GATHER4_ALPHA == 1)\n    // use #extension GL_ARB_gpu_shader5 : enable\n    #define FxaaTexAlpha4(t, p) textureGather(t, p, 3)\n    #define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)\n    #define FxaaTexGreen4(t, p) textureGather(t, p, 1)\n    #define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)\n  #endif\n#endif\n\n// -----------------------------------------------------------------------------\n\n#if (FXAA_GLSL_130 == 1)\n  // Requires \"#version 130\" or better\n  #define FxaaTexTop(t, p) textureLod(t, p, 0.0)\n  #define FxaaTexOff(t, p, o, r) textureLodOffset(t, p, 0.0, o)\n  #if (FXAA_GATHER4_ALPHA == 1)\n    // use #extension GL_ARB_gpu_shader5 : enable\n    #define FxaaTexAlpha4(t, p) textureGather(t, p, 3)\n    #define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)\n    #define FxaaTexGreen4(t, p) textureGather(t, p, 1)\n    #define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)\n  #endif\n#endif\n\n// -----------------------------------------------------------------------------\n\n#if (FXAA_HLSL_3 == 1)\n  #define FxaaInt2 float2\n  #define FxaaTex sampler2D\n  #define FxaaTexTop(t, p) tex2Dlod(t, float4(p, 0.0, 0.0))\n  #define FxaaTexOff(t, p, o, r) tex2Dlod(t, float4(p + (o * r), 0, 0))\n#endif\n\n// -----------------------------------------------------------------------------\n\n#if (FXAA_HLSL_4 == 1)\n  #define FxaaInt2 int2\n  struct FxaaTex { SamplerState smpl; Texture2D tex; };\n  #define FxaaTexTop(t, p) t.tex.SampleLevel(t.smpl, p, 0.0)\n  #define FxaaTexOff(t, p, o, r) t.tex.SampleLevel(t.smpl, p, 0.0, o)\n#endif\n\n// -----------------------------------------------------------------------------\n\n#if (FXAA_HLSL_5 == 1)\n  #define FxaaInt2 int2\n  struct FxaaTex { SamplerState smpl; Texture2D tex; };\n  #define FxaaTexTop(t, p) t.tex.SampleLevel(t.smpl, p, 0.0)\n  #define FxaaTexOff(t, p, o, r) t.tex.SampleLevel(t.smpl, p, 0.0, o)\n  #define FxaaTexAlpha4(t, p) t.tex.GatherAlpha(t.smpl, p)\n  #define FxaaTexOffAlpha4(t, p, o) t.tex.GatherAlpha(t.smpl, p, o)\n  #define FxaaTexGreen4(t, p) t.tex.GatherGreen(t.smpl, p)\n  #define FxaaTexOffGreen4(t, p, o) t.tex.GatherGreen(t.smpl, p, o)\n#endif\n\n// -----------------------------------------------------------------------------\n//  GREEN AS LUMA OPTION SUPPORT FUNCTION\n\n#if (FXAA_GREEN_AS_LUMA == 0)\n  FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.w; }\n#else\n  FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.y; }\n#endif\n\n// -----------------------------------------------------------------------------\n//  FXAA3 QUALITY - PC\n\nFxaaFloat4 FxaaPixelShader(\n  // Use noperspective interpolation here (turn off perspective interpolation).\n  // {xy} = center of pixel\n  FxaaFloat2 pos,\n\n  // Input color texture.\n  // {rgb_} = color in linear or perceptual color space\n  // if (FXAA_GREEN_AS_LUMA == 0)\n  //   {___a} = luma in perceptual color space (not linear)\n  FxaaTex tex,\n\n  // Only used on FXAA Quality.\n  // This must be from a constant/uniform.\n  // {x_} = 1.0/screenWidthInPixels\n  // {_y} = 1.0/screenHeightInPixels\n  FxaaFloat2 fxaaQualityRcpFrame,\n\n  // Only used on FXAA Quality.\n  // This used to be the FXAA_QUALITY_SUBPIX define.\n  // It is here now to allow easier tuning.\n  // Choose the amount of sub-pixel aliasing removal.\n  // This can effect sharpness.\n  //   1.00 - upper limit (softer)\n  //   0.75 - default amount of filtering\n  //   0.50 - lower limit (sharper, less sub-pixel aliasing removal)\n  //   0.25 - almost off\n  //   0.00 - completely off\n  FxaaFloat fxaaQualitySubpix,\n\n  // Only used on FXAA Quality.\n  // This used to be the FXAA_QUALITY_EDGE_THRESHOLD define.\n  // It is here now to allow easier tuning.\n  // The minimum amount of local contrast required to apply algorithm.\n  //   0.333 - too little (faster)\n  //   0.250 - low quality\n  //   0.166 - default\n  //   0.125 - high quality\n  //   0.063 - overkill (slower)\n  FxaaFloat fxaaQualityEdgeThreshold,\n\n  // Only used on FXAA Quality.\n  // This used to be the FXAA_QUALITY_EDGE_THRESHOLD_MIN define.\n  // It is here now to allow easier tuning.\n  // Trims the algorithm from processing darks.\n  //   0.0833 - upper limit (default, the start of visible unfiltered edges)\n  //   0.0625 - high quality (faster)\n  //   0.0312 - visible limit (slower)\n  // Special notes when using FXAA_GREEN_AS_LUMA,\n  //   Likely want to set this to zero.\n  //   As colors that are mostly not-green\n  //   will appear very dark in the green channel!\n  //   Tune by looking at mostly non-green content,\n  //   then start at zero and increase until aliasing is a problem.\n  FxaaFloat fxaaQualityEdgeThresholdMin\n) {\n// -----------------------------------------------------------------------------\n  FxaaFloat2 posM;\n  posM.x = pos.x;\n  posM.y = pos.y;\n  #if (FXAA_GATHER4_ALPHA == 1)\n    #if (FXAA_DISCARD == 0)\n      FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);\n      #if (FXAA_GREEN_AS_LUMA == 0)\n        #define lumaM rgbyM.w\n      #else\n        #define lumaM rgbyM.y\n      #endif\n    #endif\n    #if (FXAA_GREEN_AS_LUMA == 0)\n      FxaaFloat4 luma4A = FxaaTexAlpha4(tex, posM);\n      FxaaFloat4 luma4B = FxaaTexOffAlpha4(tex, posM, FxaaInt2(-1, -1));\n    #else\n      FxaaFloat4 luma4A = FxaaTexGreen4(tex, posM);\n      FxaaFloat4 luma4B = FxaaTexOffGreen4(tex, posM, FxaaInt2(-1, -1));\n    #endif\n    #if (FXAA_DISCARD == 1)\n      #define lumaM luma4A.w\n    #endif\n    #define lumaE luma4A.z\n    #define lumaS luma4A.x\n    #define lumaSE luma4A.y\n    #define lumaNW luma4B.w\n    #define lumaN luma4B.z\n    #define lumaW luma4B.x\n  #else\n    FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);\n    #if (FXAA_GREEN_AS_LUMA == 0)\n      #define lumaM rgbyM.w\n    #else\n      #define lumaM rgbyM.y\n    #endif\n      #if (FXAA_GLSL_100 == 1)\n        FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0, 1.0), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 0.0), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0,-1.0), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 0.0), fxaaQualityRcpFrame.xy));\n      #else\n        FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0, 1), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 0), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0,-1), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 0), fxaaQualityRcpFrame.xy));\n      #endif\n  #endif\n// -----------------------------------------------------------------------------\n  FxaaFloat maxSM = max(lumaS, lumaM);\n  FxaaFloat minSM = min(lumaS, lumaM);\n  FxaaFloat maxESM = max(lumaE, maxSM);\n  FxaaFloat minESM = min(lumaE, minSM);\n  FxaaFloat maxWN = max(lumaN, lumaW);\n  FxaaFloat minWN = min(lumaN, lumaW);\n  FxaaFloat rangeMax = max(maxWN, maxESM);\n  FxaaFloat rangeMin = min(minWN, minESM);\n  FxaaFloat rangeMaxScaled = rangeMax * fxaaQualityEdgeThreshold;\n  FxaaFloat range = rangeMax - rangeMin;\n  FxaaFloat rangeMaxClamped = max(fxaaQualityEdgeThresholdMin, rangeMaxScaled);\n  FxaaBool earlyExit = range < rangeMaxClamped;\n// -----------------------------------------------------------------------------\n  if(earlyExit)\n    #if (FXAA_DISCARD == 1)\n      FxaaDiscard;\n    #else\n      return rgbyM;\n    #endif\n// -----------------------------------------------------------------------------\n  #if (FXAA_GATHER4_ALPHA == 0)\n    #if (FXAA_GLSL_100 == 1)\n      FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0,-1.0), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 1.0), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0,-1.0), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 1.0), fxaaQualityRcpFrame.xy));\n    #else\n      FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1,-1), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 1), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1,-1), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));\n    #endif\n  #else\n    FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(1, -1), fxaaQualityRcpFrame.xy));\n    FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));\n  #endif\n// -----------------------------------------------------------------------------\n  FxaaFloat lumaNS = lumaN + lumaS;\n  FxaaFloat lumaWE = lumaW + lumaE;\n  FxaaFloat subpixRcpRange = 1.0/range;\n  FxaaFloat subpixNSWE = lumaNS + lumaWE;\n  FxaaFloat edgeHorz1 = (-2.0 * lumaM) + lumaNS;\n  FxaaFloat edgeVert1 = (-2.0 * lumaM) + lumaWE;\n// -----------------------------------------------------------------------------\n  FxaaFloat lumaNESE = lumaNE + lumaSE;\n  FxaaFloat lumaNWNE = lumaNW + lumaNE;\n  FxaaFloat edgeHorz2 = (-2.0 * lumaE) + lumaNESE;\n  FxaaFloat edgeVert2 = (-2.0 * lumaN) + lumaNWNE;\n// -----------------------------------------------------------------------------\n  FxaaFloat lumaNWSW = lumaNW + lumaSW;\n  FxaaFloat lumaSWSE = lumaSW + lumaSE;\n  FxaaFloat edgeHorz4 = (abs(edgeHorz1) * 2.0) + abs(edgeHorz2);\n  FxaaFloat edgeVert4 = (abs(edgeVert1) * 2.0) + abs(edgeVert2);\n  FxaaFloat edgeHorz3 = (-2.0 * lumaW) + lumaNWSW;\n  FxaaFloat edgeVert3 = (-2.0 * lumaS) + lumaSWSE;\n  FxaaFloat edgeHorz = abs(edgeHorz3) + edgeHorz4;\n  FxaaFloat edgeVert = abs(edgeVert3) + edgeVert4;\n// -----------------------------------------------------------------------------\n  FxaaFloat subpixNWSWNESE = lumaNWSW + lumaNESE;\n  FxaaFloat lengthSign = fxaaQualityRcpFrame.x;\n  FxaaBool horzSpan = edgeHorz >= edgeVert;\n  FxaaFloat subpixA = subpixNSWE * 2.0 + subpixNWSWNESE;\n// -----------------------------------------------------------------------------\n  if(!horzSpan) lumaN = lumaW;\n  if(!horzSpan) lumaS = lumaE;\n  if(horzSpan) lengthSign = fxaaQualityRcpFrame.y;\n  FxaaFloat subpixB = (subpixA * (1.0/12.0)) - lumaM;\n// -----------------------------------------------------------------------------\n  FxaaFloat gradientN = lumaN - lumaM;\n  FxaaFloat gradientS = lumaS - lumaM;\n  FxaaFloat lumaNN = lumaN + lumaM;\n  FxaaFloat lumaSS = lumaS + lumaM;\n  FxaaBool pairN = abs(gradientN) >= abs(gradientS);\n  FxaaFloat gradient = max(abs(gradientN), abs(gradientS));\n  if(pairN) lengthSign = -lengthSign;\n  FxaaFloat subpixC = FxaaSat(abs(subpixB) * subpixRcpRange);\n// -----------------------------------------------------------------------------\n  FxaaFloat2 posB;\n  posB.x = posM.x;\n  posB.y = posM.y;\n  FxaaFloat2 offNP;\n  offNP.x = (!horzSpan) ? 0.0 : fxaaQualityRcpFrame.x;\n  offNP.y = ( horzSpan) ? 0.0 : fxaaQualityRcpFrame.y;\n  if(!horzSpan) posB.x += lengthSign * 0.5;\n  if( horzSpan) posB.y += lengthSign * 0.5;\n// -----------------------------------------------------------------------------\n  FxaaFloat2 posN;\n  posN.x = posB.x - offNP.x * FXAA_QUALITY_P0;\n  posN.y = posB.y - offNP.y * FXAA_QUALITY_P0;\n  FxaaFloat2 posP;\n  posP.x = posB.x + offNP.x * FXAA_QUALITY_P0;\n  posP.y = posB.y + offNP.y * FXAA_QUALITY_P0;\n  FxaaFloat subpixD = ((-2.0)*subpixC) + 3.0;\n  FxaaFloat lumaEndN = FxaaLuma(FxaaTexTop(tex, posN));\n  FxaaFloat subpixE = subpixC * subpixC;\n  FxaaFloat lumaEndP = FxaaLuma(FxaaTexTop(tex, posP));\n// -----------------------------------------------------------------------------\n  if(!pairN) lumaNN = lumaSS;\n  FxaaFloat gradientScaled = gradient * 1.0/4.0;\n  FxaaFloat lumaMM = lumaM - lumaNN * 0.5;\n  FxaaFloat subpixF = subpixD * subpixE;\n  FxaaBool lumaMLTZero = lumaMM < 0.0;\n// -----------------------------------------------------------------------------\n  lumaEndN -= lumaNN * 0.5;\n  lumaEndP -= lumaNN * 0.5;\n  FxaaBool doneN = abs(lumaEndN) >= gradientScaled;\n  FxaaBool doneP = abs(lumaEndP) >= gradientScaled;\n  if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P1;\n  if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P1;\n  FxaaBool doneNP = (!doneN) || (!doneP);\n  if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P1;\n  if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P1;\n// -----------------------------------------------------------------------------\n  if(doneNP) {\n    if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n    if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n    if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n    if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n    doneN = abs(lumaEndN) >= gradientScaled;\n    doneP = abs(lumaEndP) >= gradientScaled;\n    if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P2;\n    if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P2;\n    doneNP = (!doneN) || (!doneP);\n    if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P2;\n    if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P2;\n// -----------------------------------------------------------------------------\n    #if (FXAA_QUALITY_PS > 3)\n    if(doneNP) {\n      if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n      if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n      if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n      if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n      doneN = abs(lumaEndN) >= gradientScaled;\n      doneP = abs(lumaEndP) >= gradientScaled;\n      if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P3;\n      if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P3;\n      doneNP = (!doneN) || (!doneP);\n      if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P3;\n      if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P3;\n// -----------------------------------------------------------------------------\n      #if (FXAA_QUALITY_PS > 4)\n      if(doneNP) {\n        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n        doneN = abs(lumaEndN) >= gradientScaled;\n        doneP = abs(lumaEndP) >= gradientScaled;\n        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P4;\n        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P4;\n        doneNP = (!doneN) || (!doneP);\n        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P4;\n        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P4;\n// -----------------------------------------------------------------------------\n        #if (FXAA_QUALITY_PS > 5)\n        if(doneNP) {\n          if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n          if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n          if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n          if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n          doneN = abs(lumaEndN) >= gradientScaled;\n          doneP = abs(lumaEndP) >= gradientScaled;\n          if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P5;\n          if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P5;\n          doneNP = (!doneN) || (!doneP);\n          if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P5;\n          if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P5;\n// -----------------------------------------------------------------------------\n          #if (FXAA_QUALITY_PS > 6)\n          if(doneNP) {\n            if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n            if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n            if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n            if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n            doneN = abs(lumaEndN) >= gradientScaled;\n            doneP = abs(lumaEndP) >= gradientScaled;\n            if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P6;\n            if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P6;\n            doneNP = (!doneN) || (!doneP);\n            if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P6;\n            if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P6;\n// -----------------------------------------------------------------------------\n            #if (FXAA_QUALITY_PS > 7)\n            if(doneNP) {\n              if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n              if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n              if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n              if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n              doneN = abs(lumaEndN) >= gradientScaled;\n              doneP = abs(lumaEndP) >= gradientScaled;\n              if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P7;\n              if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P7;\n              doneNP = (!doneN) || (!doneP);\n              if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P7;\n              if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P7;\n// -----------------------------------------------------------------------------\n  #if (FXAA_QUALITY_PS > 8)\n  if(doneNP) {\n    if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n    if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n    if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n    if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n    doneN = abs(lumaEndN) >= gradientScaled;\n    doneP = abs(lumaEndP) >= gradientScaled;\n    if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P8;\n    if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P8;\n    doneNP = (!doneN) || (!doneP);\n    if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P8;\n    if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P8;\n// -----------------------------------------------------------------------------\n    #if (FXAA_QUALITY_PS > 9)\n    if(doneNP) {\n      if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n      if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n      if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n      if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n      doneN = abs(lumaEndN) >= gradientScaled;\n      doneP = abs(lumaEndP) >= gradientScaled;\n      if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P9;\n      if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P9;\n      doneNP = (!doneN) || (!doneP);\n      if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P9;\n      if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P9;\n// -----------------------------------------------------------------------------\n      #if (FXAA_QUALITY_PS > 10)\n      if(doneNP) {\n        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n        doneN = abs(lumaEndN) >= gradientScaled;\n        doneP = abs(lumaEndP) >= gradientScaled;\n        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P10;\n        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P10;\n        doneNP = (!doneN) || (!doneP);\n        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P10;\n        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P10;\n// -----------------------------------------------------------------------------\n        #if (FXAA_QUALITY_PS > 11)\n        if(doneNP) {\n          if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n          if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n          if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n          if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n          doneN = abs(lumaEndN) >= gradientScaled;\n          doneP = abs(lumaEndP) >= gradientScaled;\n          if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P11;\n          if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P11;\n          doneNP = (!doneN) || (!doneP);\n          if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P11;\n          if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P11;\n// -----------------------------------------------------------------------------\n          #if (FXAA_QUALITY_PS > 12)\n          if(doneNP) {\n            if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n            if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n            if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n            if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n            doneN = abs(lumaEndN) >= gradientScaled;\n            doneP = abs(lumaEndP) >= gradientScaled;\n            if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P12;\n            if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P12;\n            doneNP = (!doneN) || (!doneP);\n            if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P12;\n            if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P12;\n// -----------------------------------------------------------------------------\n          }\n          #endif\n// -----------------------------------------------------------------------------\n        }\n        #endif\n// -----------------------------------------------------------------------------\n      }\n      #endif\n// -----------------------------------------------------------------------------\n    }\n    #endif\n// -----------------------------------------------------------------------------\n  }\n  #endif\n// -----------------------------------------------------------------------------\n            }\n            #endif\n// -----------------------------------------------------------------------------\n          }\n          #endif\n// -----------------------------------------------------------------------------\n        }\n        #endif\n// -----------------------------------------------------------------------------\n      }\n      #endif\n// -----------------------------------------------------------------------------\n    }\n    #endif\n// -----------------------------------------------------------------------------\n  }\n// -----------------------------------------------------------------------------\n  FxaaFloat dstN = posM.x - posN.x;\n  FxaaFloat dstP = posP.x - posM.x;\n  if(!horzSpan) dstN = posM.y - posN.y;\n  if(!horzSpan) dstP = posP.y - posM.y;\n// -----------------------------------------------------------------------------\n  FxaaBool goodSpanN = (lumaEndN < 0.0) != lumaMLTZero;\n  FxaaFloat spanLength = (dstP + dstN);\n  FxaaBool goodSpanP = (lumaEndP < 0.0) != lumaMLTZero;\n  FxaaFloat spanLengthRcp = 1.0/spanLength;\n// -----------------------------------------------------------------------------\n  FxaaBool directionN = dstN < dstP;\n  FxaaFloat dst = min(dstN, dstP);\n  FxaaBool goodSpan = directionN ? goodSpanN : goodSpanP;\n  FxaaFloat subpixG = subpixF * subpixF;\n  FxaaFloat pixelOffset = (dst * (-spanLengthRcp)) + 0.5;\n  FxaaFloat subpixH = subpixG * fxaaQualitySubpix;\n// -----------------------------------------------------------------------------\n  FxaaFloat pixelOffsetGood = goodSpan ? pixelOffset : 0.0;\n  FxaaFloat pixelOffsetSubpix = max(pixelOffsetGood, subpixH);\n  if(!horzSpan) posM.x += pixelOffsetSubpix * lengthSign;\n  if( horzSpan) posM.y += pixelOffsetSubpix * lengthSign;\n  #if (FXAA_DISCARD == 1)\n    return FxaaTexTop(tex, posM);\n  #else\n    return FxaaFloat4(FxaaTexTop(tex, posM).xyz, lumaM);\n  #endif\n}\n";

var vertexShader$3 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

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

var FXAAPass = function (_Three$ShaderPass) {
  inherits(FXAAPass, _Three$ShaderPass);

  function FXAAPass() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$quality = _ref.quality,
        quality = _ref$quality === undefined ? 12 : _ref$quality,
        _ref$subpix = _ref.subpix,
        subpix = _ref$subpix === undefined ? 0.75 : _ref$subpix,
        _ref$edgeThreshold = _ref.edgeThreshold,
        edgeThreshold = _ref$edgeThreshold === undefined ? 0.125 : _ref$edgeThreshold,
        _ref$edgeThresholdMin = _ref.edgeThresholdMin,
        edgeThresholdMin = _ref$edgeThresholdMin === undefined ? 0.0625 : _ref$edgeThresholdMin;

    classCallCheck(this, FXAAPass);

    var uniforms = {
      tDiffuse: { value: null },
      resolution: { value: new Three.Vector2(1 / 512, 1 / 512) }
      // eslint-disable-next-line no-unused-vars
    };var shader = {
      uniforms: uniforms,
      vertexShader: vertexShader$3,
      fragmentShader: index(fragmentShader$3, {
        fxaaShader: fxaaShader,
        quality: quality,
        subpix: subpix,
        edgeThreshold: edgeThreshold,
        edgeThresholdMin: edgeThresholdMin
      })
    };
    return possibleConstructorReturn(this, (FXAAPass.__proto__ || Object.getPrototypeOf(FXAAPass)).call(this, Three.FXAAShader));
  }

  createClass(FXAAPass, [{
    key: 'setSize',
    value: function setSize(width, height) {
      this.uniforms.resolution.value.set(1 / width, 1 / height);
    }
  }]);
  return FXAAPass;
}(Three.ShaderPass);

var fragmentShader$4 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nuniform sampler2D tDiffuse;\n\nvarying vec2 vUv;\n\nvoid main() {\n  vec4 color = texture2D(tDiffuse, vUv);\n  gl_FragColor.rgb = color.rgb;\n  gl_FragColor.a = dot(color.rgb, vec3(0.299, 0.587, 0.114));\n}\n";

var vertexShader$4 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

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

var LumaPass = function (_Three$ShaderPass) {
  inherits(LumaPass, _Three$ShaderPass);

  function LumaPass() {
    classCallCheck(this, LumaPass);

    var uniforms = {
      tDiffuse: { value: null }
    };
    var shader = { uniforms: uniforms, vertexShader: vertexShader$4, fragmentShader: fragmentShader$4 };
    return possibleConstructorReturn(this, (LumaPass.__proto__ || Object.getPrototypeOf(LumaPass)).call(this, shader));
  }

  return LumaPass;
}(Three.ShaderPass);

(function (THREE) {
	/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Full-screen textured quad shader
 */

	THREE.CopyShader = {

		uniforms: {

			"tDiffuse": { value: null },
			"opacity": { value: 1.0 }

		},

		vertexShader: ["varying vec2 vUv;", "void main() {", "vUv = uv;", "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );", "}"].join("\n"),

		fragmentShader: ["uniform float opacity;", "uniform sampler2D tDiffuse;", "varying vec2 vUv;", "void main() {", "vec4 texel = texture2D( tDiffuse, vUv );", "gl_FragColor = opacity * texel;", "}"].join("\n")

	};
})(Three);

(function (THREE) {
			/**
   * @author mpk / http://polko.me/
   *
   * WebGL port of Subpixel Morphological Antialiasing (SMAA) v2.8
   * Preset: SMAA 1x Medium (with color edge detection)
   * https://github.com/iryoku/smaa/releases/tag/v2.8
   */

			THREE.SMAAShader = [{

						defines: {

									"SMAA_THRESHOLD": "0.1"

						},

						uniforms: {

									"tDiffuse": { value: null },
									"resolution": { value: new THREE.Vector2(1 / 1024, 1 / 512) }

						},

						vertexShader: ["uniform vec2 resolution;", "varying vec2 vUv;", "varying vec4 vOffset[ 3 ];", "void SMAAEdgeDetectionVS( vec2 texcoord ) {", "vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0,  1.0 );", // WebGL port note: Changed sign in W component
						"vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4(  1.0, 0.0, 0.0, -1.0 );", // WebGL port note: Changed sign in W component
						"vOffset[ 2 ] = texcoord.xyxy + resolution.xyxy * vec4( -2.0, 0.0, 0.0,  2.0 );", // WebGL port note: Changed sign in W component
						"}", "void main() {", "vUv = uv;", "SMAAEdgeDetectionVS( vUv );", "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );", "}"].join("\n"),

						fragmentShader: ["uniform sampler2D tDiffuse;", "varying vec2 vUv;", "varying vec4 vOffset[ 3 ];", "vec4 SMAAColorEdgeDetectionPS( vec2 texcoord, vec4 offset[3], sampler2D colorTex ) {", "vec2 threshold = vec2( SMAA_THRESHOLD, SMAA_THRESHOLD );",

						// Calculate color deltas:
						"vec4 delta;", "vec3 C = texture2D( colorTex, texcoord ).rgb;", "vec3 Cleft = texture2D( colorTex, offset[0].xy ).rgb;", "vec3 t = abs( C - Cleft );", "delta.x = max( max( t.r, t.g ), t.b );", "vec3 Ctop = texture2D( colorTex, offset[0].zw ).rgb;", "t = abs( C - Ctop );", "delta.y = max( max( t.r, t.g ), t.b );",

						// We do the usual threshold:
						"vec2 edges = step( threshold, delta.xy );",

						// Then discard if there is no edge:
						"if ( dot( edges, vec2( 1.0, 1.0 ) ) == 0.0 )", "discard;",

						// Calculate right and bottom deltas:
						"vec3 Cright = texture2D( colorTex, offset[1].xy ).rgb;", "t = abs( C - Cright );", "delta.z = max( max( t.r, t.g ), t.b );", "vec3 Cbottom  = texture2D( colorTex, offset[1].zw ).rgb;", "t = abs( C - Cbottom );", "delta.w = max( max( t.r, t.g ), t.b );",

						// Calculate the maximum delta in the direct neighborhood:
						"float maxDelta = max( max( max( delta.x, delta.y ), delta.z ), delta.w );",

						// Calculate left-left and top-top deltas:
						"vec3 Cleftleft  = texture2D( colorTex, offset[2].xy ).rgb;", "t = abs( C - Cleftleft );", "delta.z = max( max( t.r, t.g ), t.b );", "vec3 Ctoptop = texture2D( colorTex, offset[2].zw ).rgb;", "t = abs( C - Ctoptop );", "delta.w = max( max( t.r, t.g ), t.b );",

						// Calculate the final maximum delta:
						"maxDelta = max( max( maxDelta, delta.z ), delta.w );",

						// Local contrast adaptation in action:
						"edges.xy *= step( 0.5 * maxDelta, delta.xy );", "return vec4( edges, 0.0, 0.0 );", "}", "void main() {", "gl_FragColor = SMAAColorEdgeDetectionPS( vUv, vOffset, tDiffuse );", "}"].join("\n")

			}, {

						defines: {

									"SMAA_MAX_SEARCH_STEPS": "8",
									"SMAA_AREATEX_MAX_DISTANCE": "16",
									"SMAA_AREATEX_PIXEL_SIZE": "( 1.0 / vec2( 160.0, 560.0 ) )",
									"SMAA_AREATEX_SUBTEX_SIZE": "( 1.0 / 7.0 )"

						},

						uniforms: {

									"tDiffuse": { value: null },
									"tArea": { value: null },
									"tSearch": { value: null },
									"resolution": { value: new THREE.Vector2(1 / 1024, 1 / 512) }

						},

						vertexShader: ["uniform vec2 resolution;", "varying vec2 vUv;", "varying vec4 vOffset[ 3 ];", "varying vec2 vPixcoord;", "void SMAABlendingWeightCalculationVS( vec2 texcoord ) {", "vPixcoord = texcoord / resolution;",

						// We will use these offsets for the searches later on (see @PSEUDO_GATHER4):
						"vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.25, 0.125, 1.25, 0.125 );", // WebGL port note: Changed sign in Y and W components
						"vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.125, 0.25, -0.125, -1.25 );", // WebGL port note: Changed sign in Y and W components

						// And these for the searches, they indicate the ends of the loops:
						"vOffset[ 2 ] = vec4( vOffset[ 0 ].xz, vOffset[ 1 ].yw ) + vec4( -2.0, 2.0, -2.0, 2.0 ) * resolution.xxyy * float( SMAA_MAX_SEARCH_STEPS );", "}", "void main() {", "vUv = uv;", "SMAABlendingWeightCalculationVS( vUv );", "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );", "}"].join("\n"),

						fragmentShader: ["#define SMAASampleLevelZeroOffset( tex, coord, offset ) texture2D( tex, coord + float( offset ) * resolution, 0.0 )", "uniform sampler2D tDiffuse;", "uniform sampler2D tArea;", "uniform sampler2D tSearch;", "uniform vec2 resolution;", "varying vec2 vUv;", "varying vec4 vOffset[3];", "varying vec2 vPixcoord;", "vec2 round( vec2 x ) {", "return sign( x ) * floor( abs( x ) + 0.5 );", "}", "float SMAASearchLength( sampler2D searchTex, vec2 e, float bias, float scale ) {",
						// Not required if searchTex accesses are set to point:
						// float2 SEARCH_TEX_PIXEL_SIZE = 1.0 / float2(66.0, 33.0);
						// e = float2(bias, 0.0) + 0.5 * SEARCH_TEX_PIXEL_SIZE +
						//     e * float2(scale, 1.0) * float2(64.0, 32.0) * SEARCH_TEX_PIXEL_SIZE;
						"e.r = bias + e.r * scale;", "return 255.0 * texture2D( searchTex, e, 0.0 ).r;", "}", "float SMAASearchXLeft( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {",
						/**
      * @PSEUDO_GATHER4
      * This texcoord has been offset by (-0.25, -0.125) in the vertex shader to
      * sample between edge, thus fetching four edges in a row.
      * Sampling with different offsets in each direction allows to disambiguate
      * which edges are active from the four fetched ones.
      */
						"vec2 e = vec2( 0.0, 1.0 );", "for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) {", // WebGL port note: Changed while to for
						"e = texture2D( edgesTex, texcoord, 0.0 ).rg;", "texcoord -= vec2( 2.0, 0.0 ) * resolution;", "if ( ! ( texcoord.x > end && e.g > 0.8281 && e.r == 0.0 ) ) break;", "}",

						// We correct the previous (-0.25, -0.125) offset we applied:
						"texcoord.x += 0.25 * resolution.x;",

						// The searches are bias by 1, so adjust the coords accordingly:
						"texcoord.x += resolution.x;",

						// Disambiguate the length added by the last step:
						"texcoord.x += 2.0 * resolution.x;", // Undo last step
						"texcoord.x -= resolution.x * SMAASearchLength(searchTex, e, 0.0, 0.5);", "return texcoord.x;", "}", "float SMAASearchXRight( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {", "vec2 e = vec2( 0.0, 1.0 );", "for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) {", // WebGL port note: Changed while to for
						"e = texture2D( edgesTex, texcoord, 0.0 ).rg;", "texcoord += vec2( 2.0, 0.0 ) * resolution;", "if ( ! ( texcoord.x < end && e.g > 0.8281 && e.r == 0.0 ) ) break;", "}", "texcoord.x -= 0.25 * resolution.x;", "texcoord.x -= resolution.x;", "texcoord.x -= 2.0 * resolution.x;", "texcoord.x += resolution.x * SMAASearchLength( searchTex, e, 0.5, 0.5 );", "return texcoord.x;", "}", "float SMAASearchYUp( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {", "vec2 e = vec2( 1.0, 0.0 );", "for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) {", // WebGL port note: Changed while to for
						"e = texture2D( edgesTex, texcoord, 0.0 ).rg;", "texcoord += vec2( 0.0, 2.0 ) * resolution;", // WebGL port note: Changed sign
						"if ( ! ( texcoord.y > end && e.r > 0.8281 && e.g == 0.0 ) ) break;", "}", "texcoord.y -= 0.25 * resolution.y;", // WebGL port note: Changed sign
						"texcoord.y -= resolution.y;", // WebGL port note: Changed sign
						"texcoord.y -= 2.0 * resolution.y;", // WebGL port note: Changed sign
						"texcoord.y += resolution.y * SMAASearchLength( searchTex, e.gr, 0.0, 0.5 );", // WebGL port note: Changed sign

						"return texcoord.y;", "}", "float SMAASearchYDown( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {", "vec2 e = vec2( 1.0, 0.0 );", "for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) {", // WebGL port note: Changed while to for
						"e = texture2D( edgesTex, texcoord, 0.0 ).rg;", "texcoord -= vec2( 0.0, 2.0 ) * resolution;", // WebGL port note: Changed sign
						"if ( ! ( texcoord.y < end && e.r > 0.8281 && e.g == 0.0 ) ) break;", "}", "texcoord.y += 0.25 * resolution.y;", // WebGL port note: Changed sign
						"texcoord.y += resolution.y;", // WebGL port note: Changed sign
						"texcoord.y += 2.0 * resolution.y;", // WebGL port note: Changed sign
						"texcoord.y -= resolution.y * SMAASearchLength( searchTex, e.gr, 0.5, 0.5 );", // WebGL port note: Changed sign

						"return texcoord.y;", "}", "vec2 SMAAArea( sampler2D areaTex, vec2 dist, float e1, float e2, float offset ) {",
						// Rounding prevents precision errors of bilinear filtering:
						"vec2 texcoord = float( SMAA_AREATEX_MAX_DISTANCE ) * round( 4.0 * vec2( e1, e2 ) ) + dist;",

						// We do a scale and bias for mapping to texel space:
						"texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + ( 0.5 * SMAA_AREATEX_PIXEL_SIZE );",

						// Move to proper place, according to the subpixel offset:
						"texcoord.y += SMAA_AREATEX_SUBTEX_SIZE * offset;", "return texture2D( areaTex, texcoord, 0.0 ).rg;", "}", "vec4 SMAABlendingWeightCalculationPS( vec2 texcoord, vec2 pixcoord, vec4 offset[ 3 ], sampler2D edgesTex, sampler2D areaTex, sampler2D searchTex, ivec4 subsampleIndices ) {", "vec4 weights = vec4( 0.0, 0.0, 0.0, 0.0 );", "vec2 e = texture2D( edgesTex, texcoord ).rg;", "if ( e.g > 0.0 ) {", // Edge at north
						"vec2 d;",

						// Find the distance to the left:
						"vec2 coords;", "coords.x = SMAASearchXLeft( edgesTex, searchTex, offset[ 0 ].xy, offset[ 2 ].x );", "coords.y = offset[ 1 ].y;", // offset[1].y = texcoord.y - 0.25 * resolution.y (@CROSSING_OFFSET)
						"d.x = coords.x;",

						// Now fetch the left crossing edges, two at a time using bilinear
						// filtering. Sampling at -0.25 (see @CROSSING_OFFSET) enables to
						// discern what value each edge has:
						"float e1 = texture2D( edgesTex, coords, 0.0 ).r;",

						// Find the distance to the right:
						"coords.x = SMAASearchXRight( edgesTex, searchTex, offset[ 0 ].zw, offset[ 2 ].y );", "d.y = coords.x;",

						// We want the distances to be in pixel units (doing this here allow to
						// better interleave arithmetic and memory accesses):
						"d = d / resolution.x - pixcoord.x;",

						// SMAAArea below needs a sqrt, as the areas texture is compressed
						// quadratically:
						"vec2 sqrt_d = sqrt( abs( d ) );",

						// Fetch the right crossing edges:
						"coords.y -= 1.0 * resolution.y;", // WebGL port note: Added
						"float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 1, 0 ) ).r;",

						// Ok, we know how this pattern looks like, now it is time for getting
						// the actual area:
						"weights.rg = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.y ) );", "}", "if ( e.r > 0.0 ) {", // Edge at west
						"vec2 d;",

						// Find the distance to the top:
						"vec2 coords;", "coords.y = SMAASearchYUp( edgesTex, searchTex, offset[ 1 ].xy, offset[ 2 ].z );", "coords.x = offset[ 0 ].x;", // offset[1].x = texcoord.x - 0.25 * resolution.x;
						"d.x = coords.y;",

						// Fetch the top crossing edges:
						"float e1 = texture2D( edgesTex, coords, 0.0 ).g;",

						// Find the distance to the bottom:
						"coords.y = SMAASearchYDown( edgesTex, searchTex, offset[ 1 ].zw, offset[ 2 ].w );", "d.y = coords.y;",

						// We want the distances to be in pixel units:
						"d = d / resolution.y - pixcoord.y;",

						// SMAAArea below needs a sqrt, as the areas texture is compressed
						// quadratically:
						"vec2 sqrt_d = sqrt( abs( d ) );",

						// Fetch the bottom crossing edges:
						"coords.y -= 1.0 * resolution.y;", // WebGL port note: Added
						"float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 0, 1 ) ).g;",

						// Get the area for this direction:
						"weights.ba = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.x ) );", "}", "return weights;", "}", "void main() {", "gl_FragColor = SMAABlendingWeightCalculationPS( vUv, vPixcoord, vOffset, tDiffuse, tArea, tSearch, ivec4( 0.0 ) );", "}"].join("\n")

			}, {

						uniforms: {

									"tDiffuse": { value: null },
									"tColor": { value: null },
									"resolution": { value: new THREE.Vector2(1 / 1024, 1 / 512) }

						},

						vertexShader: ["uniform vec2 resolution;", "varying vec2 vUv;", "varying vec4 vOffset[ 2 ];", "void SMAANeighborhoodBlendingVS( vec2 texcoord ) {", "vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0, 1.0 );", // WebGL port note: Changed sign in W component
						"vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( 1.0, 0.0, 0.0, -1.0 );", // WebGL port note: Changed sign in W component
						"}", "void main() {", "vUv = uv;", "SMAANeighborhoodBlendingVS( vUv );", "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );", "}"].join("\n"),

						fragmentShader: ["uniform sampler2D tDiffuse;", "uniform sampler2D tColor;", "uniform vec2 resolution;", "varying vec2 vUv;", "varying vec4 vOffset[ 2 ];", "vec4 SMAANeighborhoodBlendingPS( vec2 texcoord, vec4 offset[ 2 ], sampler2D colorTex, sampler2D blendTex ) {",
						// Fetch the blending weights for current pixel:
						"vec4 a;", "a.xz = texture2D( blendTex, texcoord ).xz;", "a.y = texture2D( blendTex, offset[ 1 ].zw ).g;", "a.w = texture2D( blendTex, offset[ 1 ].xy ).a;",

						// Is there any blending weight with a value greater than 0.0?
						"if ( dot(a, vec4( 1.0, 1.0, 1.0, 1.0 )) < 1e-5 ) {", "return texture2D( colorTex, texcoord, 0.0 );", "} else {",
						// Up to 4 lines can be crossing a pixel (one through each edge). We
						// favor blending by choosing the line with the maximum weight for each
						// direction:
						"vec2 offset;", "offset.x = a.a > a.b ? a.a : -a.b;", // left vs. right
						"offset.y = a.g > a.r ? -a.g : a.r;", // top vs. bottom // WebGL port note: Changed signs

						// Then we go in the direction that has the maximum weight:
						"if ( abs( offset.x ) > abs( offset.y )) {", // horizontal vs. vertical
						"offset.y = 0.0;", "} else {", "offset.x = 0.0;", "}",

						// Fetch the opposite color and lerp by hand:
						"vec4 C = texture2D( colorTex, texcoord, 0.0 );", "texcoord += sign( offset ) * resolution;", "vec4 Cop = texture2D( colorTex, texcoord, 0.0 );", "float s = abs( offset.x ) > abs( offset.y ) ? abs( offset.x ) : abs( offset.y );",

						// WebGL port note: Added gamma correction
						"C.xyz = pow(C.xyz, vec3(2.2));", "Cop.xyz = pow(Cop.xyz, vec3(2.2));", "vec4 mixed = mix(C, Cop, s);", "mixed.xyz = pow(mixed.xyz, vec3(1.0 / 2.2));", "return mixed;", "}", "}", "void main() {", "gl_FragColor = SMAANeighborhoodBlendingPS( vUv, vOffset, tColor, tDiffuse );", "}"].join("\n")

			}];
})(Three);

(function (THREE) {
	/**
 * @author mpk / http://polko.me/
 */

	THREE.SMAAPass = function (width, height) {

		THREE.Pass.call(this);

		// render targets

		this.edgesRT = new THREE.WebGLRenderTarget(width, height, {
			depthBuffer: false,
			stencilBuffer: false,
			generateMipmaps: false,
			minFilter: THREE.LinearFilter,
			format: THREE.RGBFormat
		});
		this.edgesRT.texture.name = "SMAAPass.edges";

		this.weightsRT = new THREE.WebGLRenderTarget(width, height, {
			depthBuffer: false,
			stencilBuffer: false,
			generateMipmaps: false,
			minFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat
		});
		this.weightsRT.texture.name = "SMAAPass.weights";

		// textures

		var areaTextureImage = new Image();
		areaTextureImage.src = this.getAreaTexture();

		this.areaTexture = new THREE.Texture();
		this.areaTexture.name = "SMAAPass.area";
		this.areaTexture.image = areaTextureImage;
		this.areaTexture.format = THREE.RGBFormat;
		this.areaTexture.minFilter = THREE.LinearFilter;
		this.areaTexture.generateMipmaps = false;
		this.areaTexture.needsUpdate = true;
		this.areaTexture.flipY = false;

		var searchTextureImage = new Image();
		searchTextureImage.src = this.getSearchTexture();

		this.searchTexture = new THREE.Texture();
		this.searchTexture.name = "SMAAPass.search";
		this.searchTexture.image = searchTextureImage;
		this.searchTexture.magFilter = THREE.NearestFilter;
		this.searchTexture.minFilter = THREE.NearestFilter;
		this.searchTexture.generateMipmaps = false;
		this.searchTexture.needsUpdate = true;
		this.searchTexture.flipY = false;

		// materials - pass 1

		if (THREE.SMAAShader === undefined) {
			console.error("THREE.SMAAPass relies on THREE.SMAAShader");
		}

		this.uniformsEdges = THREE.UniformsUtils.clone(THREE.SMAAShader[0].uniforms);

		this.uniformsEdges["resolution"].value.set(1 / width, 1 / height);

		this.materialEdges = new THREE.ShaderMaterial({
			defines: THREE.SMAAShader[0].defines,
			uniforms: this.uniformsEdges,
			vertexShader: THREE.SMAAShader[0].vertexShader,
			fragmentShader: THREE.SMAAShader[0].fragmentShader
		});

		// materials - pass 2

		this.uniformsWeights = THREE.UniformsUtils.clone(THREE.SMAAShader[1].uniforms);

		this.uniformsWeights["resolution"].value.set(1 / width, 1 / height);
		this.uniformsWeights["tDiffuse"].value = this.edgesRT.texture;
		this.uniformsWeights["tArea"].value = this.areaTexture;
		this.uniformsWeights["tSearch"].value = this.searchTexture;

		this.materialWeights = new THREE.ShaderMaterial({
			defines: THREE.SMAAShader[1].defines,
			uniforms: this.uniformsWeights,
			vertexShader: THREE.SMAAShader[1].vertexShader,
			fragmentShader: THREE.SMAAShader[1].fragmentShader
		});

		// materials - pass 3

		this.uniformsBlend = THREE.UniformsUtils.clone(THREE.SMAAShader[2].uniforms);

		this.uniformsBlend["resolution"].value.set(1 / width, 1 / height);
		this.uniformsBlend["tDiffuse"].value = this.weightsRT.texture;

		this.materialBlend = new THREE.ShaderMaterial({
			uniforms: this.uniformsBlend,
			vertexShader: THREE.SMAAShader[2].vertexShader,
			fragmentShader: THREE.SMAAShader[2].fragmentShader
		});

		this.needsSwap = false;

		this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this.scene = new THREE.Scene();

		this.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
		this.quad.frustumCulled = false; // Avoid getting clipped
		this.scene.add(this.quad);
	};

	THREE.SMAAPass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {

		constructor: THREE.SMAAPass,

		render: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {

			// pass 1

			this.uniformsEdges["tDiffuse"].value = readBuffer.texture;

			this.quad.material = this.materialEdges;

			renderer.render(this.scene, this.camera, this.edgesRT, this.clear);

			// pass 2

			this.quad.material = this.materialWeights;

			renderer.render(this.scene, this.camera, this.weightsRT, this.clear);

			// pass 3

			this.uniformsBlend["tColor"].value = readBuffer.texture;

			this.quad.material = this.materialBlend;

			if (this.renderToScreen) {

				renderer.render(this.scene, this.camera);
			} else {

				renderer.render(this.scene, this.camera, writeBuffer, this.clear);
			}
		},

		setSize: function setSize(width, height) {

			this.edgesRT.setSize(width, height);
			this.weightsRT.setSize(width, height);

			this.materialEdges.uniforms['resolution'].value.set(1 / width, 1 / height);
			this.materialWeights.uniforms['resolution'].value.set(1 / width, 1 / height);
			this.materialBlend.uniforms['resolution'].value.set(1 / width, 1 / height);
		},

		getAreaTexture: function getAreaTexture() {
			return 'data:image/png;base64,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';
		},

		getSearchTexture: function getSearchTexture() {
			return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAhCAAAAABIXyLAAAAAOElEQVRIx2NgGAWjYBSMglEwEICREYRgFBZBqDCSLA2MGPUIVQETE9iNUAqLR5gIeoQKRgwXjwAAGn4AtaFeYLEAAAAASUVORK5CYII=';
		}

	});
})(Three);

(function (THREE) {
	/**
 *
 * Supersample Anti-Aliasing Render Pass
 *
 * @author bhouston / http://clara.io/
 *
 * This manual approach to SSAA re-renders the scene ones for each sample with camera jitter and accumulates the results.
 *
 * References: https://en.wikipedia.org/wiki/Supersampling
 *
 */

	THREE.SSAARenderPass = function (scene, camera, clearColor, clearAlpha) {

		THREE.Pass.call(this);

		this.scene = scene;
		this.camera = camera;

		this.sampleLevel = 4; // specified as n, where the number of samples is 2^n, so sampleLevel = 4, is 2^4 samples, 16.
		this.unbiased = true;

		// as we need to clear the buffer in this pass, clearColor must be set to something, defaults to black.
		this.clearColor = clearColor !== undefined ? clearColor : 0x000000;
		this.clearAlpha = clearAlpha !== undefined ? clearAlpha : 0;

		if (THREE.CopyShader === undefined) console.error("THREE.SSAARenderPass relies on THREE.CopyShader");

		var copyShader = THREE.CopyShader;
		this.copyUniforms = THREE.UniformsUtils.clone(copyShader.uniforms);

		this.copyMaterial = new THREE.ShaderMaterial({
			uniforms: this.copyUniforms,
			vertexShader: copyShader.vertexShader,
			fragmentShader: copyShader.fragmentShader,
			premultipliedAlpha: true,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthTest: false,
			depthWrite: false
		});

		this.camera2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this.scene2 = new THREE.Scene();
		this.quad2 = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMaterial);
		this.quad2.frustumCulled = false; // Avoid getting clipped
		this.scene2.add(this.quad2);
	};

	THREE.SSAARenderPass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {

		constructor: THREE.SSAARenderPass,

		dispose: function dispose() {

			if (this.sampleRenderTarget) {

				this.sampleRenderTarget.dispose();
				this.sampleRenderTarget = null;
			}
		},

		setSize: function setSize(width, height) {

			if (this.sampleRenderTarget) this.sampleRenderTarget.setSize(width, height);
		},

		render: function render(renderer, writeBuffer, readBuffer) {

			if (!this.sampleRenderTarget) {

				this.sampleRenderTarget = new THREE.WebGLRenderTarget(readBuffer.width, readBuffer.height, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
				this.sampleRenderTarget.texture.name = "SSAARenderPass.sample";
			}

			var jitterOffsets = THREE.SSAARenderPass.JitterVectors[Math.max(0, Math.min(this.sampleLevel, 5))];

			var autoClear = renderer.autoClear;
			renderer.autoClear = false;

			var oldClearColor = renderer.getClearColor().getHex();
			var oldClearAlpha = renderer.getClearAlpha();

			var baseSampleWeight = 1.0 / jitterOffsets.length;
			var roundingRange = 1 / 32;
			this.copyUniforms["tDiffuse"].value = this.sampleRenderTarget.texture;

			var width = readBuffer.width,
			    height = readBuffer.height;

			// render the scene multiple times, each slightly jitter offset from the last and accumulate the results.
			for (var i = 0; i < jitterOffsets.length; i++) {

				var jitterOffset = jitterOffsets[i];

				if (this.camera.setViewOffset) {

					this.camera.setViewOffset(width, height, jitterOffset[0] * 0.0625, jitterOffset[1] * 0.0625, // 0.0625 = 1 / 16
					width, height);
				}

				var sampleWeight = baseSampleWeight;

				if (this.unbiased) {

					// the theory is that equal weights for each sample lead to an accumulation of rounding errors.
					// The following equation varies the sampleWeight per sample so that it is uniformly distributed
					// across a range of values whose rounding errors cancel each other out.

					var uniformCenteredDistribution = -0.5 + (i + 0.5) / jitterOffsets.length;
					sampleWeight += roundingRange * uniformCenteredDistribution;
				}

				this.copyUniforms["opacity"].value = sampleWeight;
				renderer.setClearColor(this.clearColor, this.clearAlpha);
				renderer.render(this.scene, this.camera, this.sampleRenderTarget, true);

				if (i === 0) {

					renderer.setClearColor(0x000000, 0.0);
				}

				renderer.render(this.scene2, this.camera2, this.renderToScreen ? null : writeBuffer, i === 0);
			}

			if (this.camera.clearViewOffset) this.camera.clearViewOffset();

			renderer.autoClear = autoClear;
			renderer.setClearColor(oldClearColor, oldClearAlpha);
		}

	});

	// These jitter vectors are specified in integers because it is easier.
	// I am assuming a [-8,8) integer grid, but it needs to be mapped onto [-0.5,0.5)
	// before being used, thus these integers need to be scaled by 1/16.
	//
	// Sample patterns reference: https://msdn.microsoft.com/en-us/library/windows/desktop/ff476218%28v=vs.85%29.aspx?f=255&MSPPError=-2147217396
	THREE.SSAARenderPass.JitterVectors = [[[0, 0]], [[4, 4], [-4, -4]], [[-2, -6], [6, -2], [-6, 2], [2, 6]], [[1, -3], [-1, 3], [5, 1], [-3, -5], [-5, 5], [-7, -1], [3, 7], [7, -7]], [[1, 1], [-1, -3], [-3, 2], [4, -1], [-5, -2], [2, 5], [5, 3], [3, -5], [-2, 6], [0, -7], [-4, -6], [-6, 4], [-8, 0], [7, -4], [6, 7], [-7, -8]], [[-4, -7], [-7, -5], [-3, -5], [-5, -4], [-1, -4], [-2, -2], [-6, -1], [-4, 0], [-7, 1], [-1, 2], [-6, 3], [-3, 3], [-7, 6], [-3, 6], [-5, 7], [-1, 7], [5, -7], [1, -6], [6, -5], [4, -4], [2, -3], [7, -2], [1, -1], [4, -1], [2, 1], [6, 2], [0, 4], [4, 4], [2, 5], [7, 5], [5, 6], [3, 7]]];
})(Three);

(function (THREE) {
	/**
 * @author alteredq / http://alteredqualia.com/
 */

	THREE.RenderPass = function (scene, camera, overrideMaterial, clearColor, clearAlpha) {

		THREE.Pass.call(this);

		this.scene = scene;
		this.camera = camera;

		this.overrideMaterial = overrideMaterial;

		this.clearColor = clearColor;
		this.clearAlpha = clearAlpha !== undefined ? clearAlpha : 0;

		this.clear = true;
		this.clearDepth = false;
		this.needsSwap = false;
	};

	THREE.RenderPass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {

		constructor: THREE.RenderPass,

		render: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {

			var oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;

			this.scene.overrideMaterial = this.overrideMaterial;

			var oldClearColor, oldClearAlpha;

			if (this.clearColor) {

				oldClearColor = renderer.getClearColor().getHex();
				oldClearAlpha = renderer.getClearAlpha();

				renderer.setClearColor(this.clearColor, this.clearAlpha);
			}

			if (this.clearDepth) {

				renderer.clearDepth();
			}

			renderer.render(this.scene, this.camera, this.renderToScreen ? null : readBuffer, this.clear);

			if (this.clearColor) {

				renderer.setClearColor(oldClearColor, oldClearAlpha);
			}

			this.scene.overrideMaterial = null;
			renderer.autoClear = oldAutoClear;
		}

	});
})(Three);

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

var RenderPass$1 = function (_Three$RenderPass) {
  inherits(RenderPass$$1, _Three$RenderPass);

  function RenderPass$$1() {
    var _ref;

    classCallCheck(this, RenderPass$$1);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var _this = possibleConstructorReturn(this, (_ref = RenderPass$$1.__proto__ || Object.getPrototypeOf(RenderPass$$1)).call.apply(_ref, [this].concat(args)));

    _this.info = {
      render: {},
      memory: {},
      programs: []
    };
    return _this;
  }

  createClass(RenderPass$$1, [{
    key: 'render',
    value: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {
      get(RenderPass$$1.prototype.__proto__ || Object.getPrototypeOf(RenderPass$$1.prototype), 'render', this).call(this, renderer, writeBuffer, readBuffer, delta, maskActive);
      this.info = {
        render: _extends({}, renderer.info.render),
        memory: _extends({}, renderer.info.memory),
        programs: [].concat(toConsumableArray(renderer.info.programs))
      };
    }
  }]);
  return RenderPass$$1;
}(Three.RenderPass);

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

var internal$2 = Namespace('TiltShiftPass');

var TiltShiftPass = function (_Three$ShaderPass) {
  inherits(TiltShiftPass, _Three$ShaderPass);

  function TiltShiftPass(shader) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$amount = _ref.amount,
        amount = _ref$amount === undefined ? 9 : _ref$amount,
        _ref$center = _ref.center,
        center = _ref$center === undefined ? 0 : _ref$center;

    classCallCheck(this, TiltShiftPass);

    var _this = possibleConstructorReturn(this, (TiltShiftPass.__proto__ || Object.getPrototypeOf(TiltShiftPass)).call(this, shader));

    _this.denominator = 1000;
    _this.amount = amount;
    _this.center = center;
    return _this;
  }

  createClass(TiltShiftPass, [{
    key: 'setSize',
    value: function setSize(width, height) {
      this.uniforms.amount.value = this.amount / this.denominator;
    }
  }, {
    key: 'amount',
    get: function get$$1() {
      var scope = internal$2(this);
      return scope.amount;
    },
    set: function set$$1(value) {
      var scope = internal$2(this);
      scope.amount = value;
      this.uniforms.amount.value = value / this.denominator;
    }
  }, {
    key: 'center',
    get: function get$$1() {
      var scope = internal$2(this);
      return scope.center;
    },
    set: function set$$1(value) {
      var scope = internal$2(this);
      scope.center = value;
      this.uniforms.center.value = (value + 1) / 2;
    }
  }]);
  return TiltShiftPass;
}(Three.ShaderPass);

var fragmentShader$5 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\n#ifndef KERNEL_SIZE\n  #define KERNEL_SIZE ${size}\n#endif\n\nuniform sampler2D tDiffuse;\nuniform float amount;\nuniform float center;\nuniform float limit;\n\nvarying vec2 vUv;\n\nvoid main() {\n  vec4 color = vec4(0.0);\n  float coeff = clamp(amount * pow(abs(center - vUv.y) * 2.0, 2.0), 0.0, limit);\n\n  #if (KERNEL_SIZE == 9)\n    color += texture2D(tDiffuse, vec2(vUv.x - 4.0 * coeff, vUv.y)) * 0.0548925;\n    color += texture2D(tDiffuse, vec2(vUv.x - 3.0 * coeff, vUv.y)) * 0.08824;\n    color += texture2D(tDiffuse, vec2(vUv.x - 2.0 * coeff, vUv.y)) * 0.123853;\n    color += texture2D(tDiffuse, vec2(vUv.x - 1.0 * coeff, vUv.y)) * 0.151793;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.162443;\n    color += texture2D(tDiffuse, vec2(vUv.x + 1.0 * coeff, vUv.y)) * 0.151793;\n    color += texture2D(tDiffuse, vec2(vUv.x + 2.0 * coeff, vUv.y)) * 0.123853;\n    color += texture2D(tDiffuse, vec2(vUv.x + 3.0 * coeff, vUv.y)) * 0.08824;\n    color += texture2D(tDiffuse, vec2(vUv.x + 4.0 * coeff, vUv.y)) * 0.0548925;\n  #endif\n\n  #if (KERNEL_SIZE == 7)\n    color += texture2D(tDiffuse, vec2(vUv.x - 3.0 * coeff, vUv.y)) * 0.099122;\n    color += texture2D(tDiffuse, vec2(vUv.x - 2.0 * coeff, vUv.y)) * 0.139127;\n    color += texture2D(tDiffuse, vec2(vUv.x - 1.0 * coeff, vUv.y)) * 0.170513;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.182476;\n    color += texture2D(tDiffuse, vec2(vUv.x + 1.0 * coeff, vUv.y)) * 0.170513;\n    color += texture2D(tDiffuse, vec2(vUv.x + 2.0 * coeff, vUv.y)) * 0.139127;\n    color += texture2D(tDiffuse, vec2(vUv.x + 3.0 * coeff, vUv.y)) * 0.099122;\n  #endif\n\n  #if (KERNEL_SIZE == 5)\n    color += texture2D(tDiffuse, vec2(vUv.x - 2.0 * coeff, vUv.y)) * 0.1735285;\n    color += texture2D(tDiffuse, vec2(vUv.x - 1.0 * coeff, vUv.y)) * 0.212674;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.227595;\n    color += texture2D(tDiffuse, vec2(vUv.x + 1.0 * coeff, vUv.y)) * 0.212674;\n    color += texture2D(tDiffuse, vec2(vUv.x + 2.0 * coeff, vUv.y)) * 0.1735285;\n  #endif\n\n  gl_FragColor = color;\n}\n";

var vertexShader$5 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

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

var TiltShiftHorizontalPass = function (_TiltShiftPass) {
  inherits(TiltShiftHorizontalPass, _TiltShiftPass);

  function TiltShiftHorizontalPass() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$size = _ref.size,
        size = _ref$size === undefined ? 9 : _ref$size,
        _ref$amount = _ref.amount,
        amount = _ref$amount === undefined ? 9 : _ref$amount,
        _ref$center = _ref.center,
        center = _ref$center === undefined ? 0 : _ref$center;

    classCallCheck(this, TiltShiftHorizontalPass);

    var uniforms = {
      tDiffuse: { value: null },
      amount: { value: 1 / 512 },
      center: { value: 0.5 },
      limit: { value: 1 / 256 }
    };
    var shader = {
      uniforms: uniforms,
      vertexShader: vertexShader$5,
      fragmentShader: index(fragmentShader$5, { size: size })
    };
    return possibleConstructorReturn(this, (TiltShiftHorizontalPass.__proto__ || Object.getPrototypeOf(TiltShiftHorizontalPass)).call(this, shader, { amount: amount, center: center }));
  }

  createClass(TiltShiftHorizontalPass, [{
    key: 'setSize',
    value: function setSize(width, height) {
      this.denominator = 1024 * width / height;
      get(TiltShiftHorizontalPass.prototype.__proto__ || Object.getPrototypeOf(TiltShiftHorizontalPass.prototype), 'setSize', this).call(this, width, height);
    }
  }]);
  return TiltShiftHorizontalPass;
}(TiltShiftPass);

var fragmentShader$6 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\n#ifndef KERNEL_SIZE\n  #define KERNEL_SIZE ${size}\n#endif\n\nuniform sampler2D tDiffuse;\nuniform float amount;\nuniform float center;\nuniform float limit;\n\nvarying vec2 vUv;\n\nvoid main() {\n  vec4 color = vec4(0.0);\n  float coeff = clamp(amount * pow(abs(center - vUv.y) * 2.0, 2.0), 0.0, limit);\n\n  #if (KERNEL_SIZE == 9)\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 4.0 * coeff)) * 0.0548925;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 3.0 * coeff)) * 0.08824;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * coeff)) * 0.123853;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * coeff)) * 0.151793;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.162443;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * coeff)) * 0.151793;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * coeff)) * 0.123853;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 3.0 * coeff)) * 0.08824;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 4.0 * coeff)) * 0.0548925;\n  #endif\n\n  #if (KERNEL_SIZE == 7)\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 3.0 * coeff)) * 0.099122;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * coeff)) * 0.139127;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * coeff)) * 0.170513;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.182476;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * coeff)) * 0.170513;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * coeff)) * 0.139127;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 3.0 * coeff)) * 0.099122;\n  #endif\n\n  #if (KERNEL_SIZE == 5)\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 2.0 * coeff)) * 0.1735285;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y - 1.0 * coeff)) * 0.212674;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y)) * 0.227595;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 1.0 * coeff)) * 0.212674;\n    color += texture2D(tDiffuse, vec2(vUv.x, vUv.y + 2.0 * coeff)) * 0.1735285;\n  #endif\n\n  gl_FragColor = color;\n}\n";

var vertexShader$6 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

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

var TiltShiftVerticalPass = function (_TiltShiftPass) {
  inherits(TiltShiftVerticalPass, _TiltShiftPass);

  function TiltShiftVerticalPass() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$size = _ref.size,
        size = _ref$size === undefined ? 9 : _ref$size,
        _ref$amount = _ref.amount,
        amount = _ref$amount === undefined ? 9 : _ref$amount,
        _ref$center = _ref.center,
        center = _ref$center === undefined ? 0 : _ref$center;

    classCallCheck(this, TiltShiftVerticalPass);

    var uniforms = {
      tDiffuse: { value: null },
      amount: { value: 1 / 512 },
      center: { value: 0.5 },
      limit: { value: 1 / 256 }
    };
    var shader = {
      uniforms: uniforms,
      vertexShader: vertexShader$6,
      fragmentShader: index(fragmentShader$6, { size: size })
    };
    return possibleConstructorReturn(this, (TiltShiftVerticalPass.__proto__ || Object.getPrototypeOf(TiltShiftVerticalPass)).call(this, shader, { amount: amount, center: center }));
  }

  createClass(TiltShiftVerticalPass, [{
    key: 'setSize',
    value: function setSize(width, height) {
      this.denominator = 1000 * width / height;
      get(TiltShiftVerticalPass.prototype.__proto__ || Object.getPrototypeOf(TiltShiftVerticalPass.prototype), 'setSize', this).call(this, width, height);
    }
  }]);
  return TiltShiftVerticalPass;
}(TiltShiftPass);

var fragmentShader$7 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nfloat blendSoftLight(float base, float blend) {\n  return (blend < 0.5) ?\n      (2.0 * base * blend + base * base * (1.0 - 2.0 * blend))\n    : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend));\n}\n\nvec3 blendSoftLight(vec3 base, vec3 blend) {\n  return vec3(blendSoftLight(base.r, blend.r),\n              blendSoftLight(base.g, blend.g),\n              blendSoftLight(base.b, blend.b));\n}\n\nvec3 blendSoftLight(vec3 base, vec3 blend, float opacity) {\n  return (blendSoftLight(base, blend) * opacity + base * (1.0 - opacity));\n}\n\nuniform sampler2D tDiffuse;\nuniform sampler2D tNoise;\n\nuniform vec2 size;\nuniform float amount;\n\nvarying vec2 vUv;\n\nvoid main() {\n  // Make vivider and darker\n  vec4 pixel = texture2D(tDiffuse, vUv);\n  vec3 color = pixel.rgb;\n  vec2 uv = (vUv - vec2(0.5)) * 2.0 * vec2(\n    clamp(size.x / size.y, 0.0, 1.0),\n    clamp(size.y / size.x, 0.0, 1.0));\n  float coeff = amount * dot(uv, uv);\n  color = blendSoftLight(color, vec3(0.0), coeff);\n  color = mix(color, vec3(0.0), vec3(coeff * 0.2));\n\n  // Add noise to reduce banding\n  float noise = texture2D(tNoise, fract(vUv * size / vec2(128.0))).r;\n  color += mix(-1.0 / 64.0, 1.0 / 64.0, noise);\n\n  gl_FragColor = vec4(color, pixel.a);\n}\n";

var noiseImage = 'data:image/png;base64,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';

var vertexShader$7 = "#define GLSLIFY 1\n//\n//  The MIT License\n//\n//  Copyright (C) 2016-Present Shota Matsuda\n//\n//  Permission is hereby granted, free of charge, to any person obtaining a\n//  copy of this software and associated documentation files (the \"Software\"),\n//  to deal in the Software without restriction, including without limitation\n//  the rights to use, copy, modify, merge, publish, distribute, sublicense,\n//  and/or sell copies of the Software, and to permit persons to whom the\n//  Software is furnished to do so, subject to the following conditions:\n//\n//  The above copyright notice and this permission notice shall be included in\n//  all copies or substantial portions of the Software.\n//\n//  THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL\n//  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\n//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER\n//  DEALINGS IN THE SOFTWARE.\n//\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

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

var VignettePass = function (_Three$ShaderPass) {
  inherits(VignettePass, _Three$ShaderPass);

  function VignettePass() {
    classCallCheck(this, VignettePass);

    var uniforms = {
      tDiffuse: { value: null },
      tNoise: { value: null },
      size: { value: new Three.Vector2() },
      amount: { value: 1 }
    };
    var shader = { uniforms: uniforms, vertexShader: vertexShader$7, fragmentShader: fragmentShader$7 };

    var _this = possibleConstructorReturn(this, (VignettePass.__proto__ || Object.getPrototypeOf(VignettePass)).call(this, shader));

    _this.uniforms.tNoise.value = new Three.TextureLoader().load(noiseImage);
    return _this;
  }

  createClass(VignettePass, [{
    key: 'setSize',
    value: function setSize(width, height) {
      this.uniforms.size.value.set(width, height);
    }
  }, {
    key: 'amount',
    get: function get$$1() {
      return this.uniforms.amount.value;
    },
    set: function set$$1(value) {
      this.uniforms.amount.value = value;
    }
  }]);
  return VignettePass;
}(Three.ShaderPass);

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

var internal$1 = Namespace('Postprocess');

var Postprocess = function () {
  function Postprocess(_ref) {
    var renderer = _ref.renderer,
        width = _ref.width,
        height = _ref.height;
    classCallCheck(this, Postprocess);

    var scope = internal$1(this);
    scope.renderer = renderer;

    // The primary render target
    var pixelRatio = this.renderer.getPixelRatio();
    var deviceWidth = width * pixelRatio;
    var deviceHeight = height * pixelRatio;
    this.target = new Three.WebGLRenderTarget(deviceWidth, deviceHeight, {
      minFilter: Three.LinearFilter,
      magFilter: Three.LinearFilter,
      format: Three.RGBFormat,
      stencilBuffer: false
    });

    // Another offscreen render target is required for bloom pass
    this.bloomTarget = new Three.WebGLRenderTarget(deviceWidth, deviceHeight, {
      minFilter: Three.LinearFilter,
      magFilter: Three.LinearFilter,
      format: Three.RGBFormat,
      stencilBuffer: false
    });

    // Shader passes
    this.renderPass = new RenderPass$1();
    this.fxaaPass = new FXAAPass();
    this.msaaPass = new Three.SSAARenderPass();
    this.smaaPass = new Three.SMAAPass(deviceWidth, deviceHeight);
    this.bloomPass = new BloomPass(deviceWidth, deviceHeight, 1, 0.5, 0.5);
    this.tiltShiftHorizontalPass = new TiltShiftHorizontalPass();
    this.tiltShiftVerticalPass = new TiltShiftVerticalPass();
    this.vignettePass = new VignettePass();

    // Disable antialias passes by default
    this.fxaaPass.enabled = false;
    this.msaaPass.enabled = false;
    this.smaaPass.enabled = false;
    this.smaaPass.needsSwap = true;
    this.bloomPass.enabled = false;
    this.bloomPass.highPassUniforms.smoothWidth.value = 0.1;
    this.bloomPass.readBuffer = this.bloomTarget;

    // Effect composer
    this.composer = new Three.EffectComposer(this.renderer, this.target);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.fxaaPass);
    this.composer.addPass(this.msaaPass);
    this.composer.addPass(this.smaaPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.tiltShiftHorizontalPass);
    this.composer.addPass(this.tiltShiftVerticalPass);
    this.composer.addPass(this.vignettePass);
    this.ensureRenderToScreen();
    this.resize(width, height);
  }

  createClass(Postprocess, [{
    key: 'render',
    value: function render(scene, camera) {
      var renderer = this.renderer;
      renderer.clear();
      var bloomPass = this.bloomPass;
      if (bloomPass.enabled && bloomPass.needsSeparateRender) {
        var mask = camera.layers.mask;
        // eslint-disable-next-line no-param-reassign
        camera.layers.mask = this.bloomPass.layers.mask;
        renderer.clearTarget(this.bloomTarget, true, true, true);
        renderer.render(scene, camera, this.bloomTarget);
        bloomPass.readBuffer = this.bloomTarget;
        // eslint-disable-next-line no-param-reassign
        camera.layers.mask = mask;
      }
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
      this.msaaPass.scene = scene;
      this.msaaPass.camera = camera;
      this.composer.render();
    }
  }, {
    key: 'resize',
    value: function resize(width, height) {
      var pixelRatio = this.renderer.getPixelRatio();
      var deviceWidth = width * pixelRatio;
      var deviceHeight = height * pixelRatio;
      this.composer.setSize(deviceWidth, deviceHeight);
      this.bloomTarget.setSize(deviceWidth, deviceHeight);
    }
  }, {
    key: 'ensureRenderToScreen',
    value: function ensureRenderToScreen() {
      var lastPass = void 0;
      this.composer.passes.forEach(function (pass) {
        // eslint-disable-next-line no-param-reassign
        pass.renderToScreen = false;
        if (pass.enabled) {
          lastPass = pass;
        }
      });
      if (lastPass !== undefined) {
        lastPass.renderToScreen = true;
      }
    }
  }, {
    key: 'renderer',
    get: function get$$1() {
      var scope = internal$1(this);
      return scope.renderer;
    }
  }, {
    key: 'info',
    get: function get$$1() {
      return this.renderPass.info;
    }
  }]);
  return Postprocess;
}();

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

exports.BloomPass = BloomPass;
exports.BlurHorizontalPass = BlurHorizontalPass;
exports.BlurPass = BlurPass;
exports.BlurVerticalPass = BlurVerticalPass;
exports.ComposePass = ComposePass;
exports.FXAAPass = FXAAPass;
exports.LumaPass = LumaPass;
exports.Postprocess = Postprocess;
exports.RenderPass = RenderPass$1;
exports.TiltShiftHorizontalPass = TiltShiftHorizontalPass;
exports.TiltShiftPass = TiltShiftPass;
exports.TiltShiftVerticalPass = TiltShiftVerticalPass;
exports.VignettePass = VignettePass;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=planck-postprocess.js.map
