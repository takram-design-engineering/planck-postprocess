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

				var size = renderer.getDrawingBufferSize();
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

				var size = this.renderer.getDrawingBufferSize();
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

					var size = this.renderer.getDrawingBufferSize();

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
	 * 
	 * Inspired from Unreal Engine
	 * https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
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
			if (THREE.CopyShader === undefined) {

				console.error("THREE.BloomPass relies on THREE.CopyShader");
			}

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

			this.basic = new THREE.MeshBasicMaterial();

			this.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
			this.quad.frustumCulled = false; // Avoid getting clipped
			this.scene.add(this.quad);
		};

		THREE.UnrealBloomPass.prototype = Object.assign(Object.create(THREE.Pass.prototype), {

			constructor: THREE.UnrealBloomPass,

			dispose: function dispose() {

				for (var i = 0; i < this.renderTargetsHorizontal.length; i++) {

					this.renderTargetsHorizontal[i].dispose();
				}

				for (var i = 0; i < this.renderTargetsVertical.length; i++) {

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

				// Render input to screen

				if (this.renderToScreen) {

					this.quad.material = this.basic;
					this.basic.map = readBuffer.texture;

					renderer.render(this.scene, this.camera, undefined, true);
				}

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

				if (this.renderToScreen) {

					renderer.render(this.scene, this.camera, undefined, false);
				} else {

					renderer.render(this.scene, this.camera, readBuffer, false);
				}

				// Restore renderer settings

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

	// The MIT License

	var BloomPass = function (_Three$UnrealBloomPas) {
	  inherits(BloomPass, _Three$UnrealBloomPas);

	  function BloomPass() {
	    var width = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 256;
	    var height = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 256;

	    var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
	        _ref$strength = _ref.strength,
	        strength = _ref$strength === undefined ? 1 : _ref$strength,
	        _ref$radius = _ref.radius,
	        radius = _ref$radius === undefined ? 0.5 : _ref$radius,
	        _ref$threshold = _ref.threshold,
	        threshold = _ref$threshold === undefined ? 0.5 : _ref$threshold;

	    classCallCheck(this, BloomPass);

	    // UnrealBloomPass divides the resolution by 2 for the bright render target
	    // and the largest mipmap target, that makes light bleeding much visible.
	    // Use the twice larger resolution here to minimize that.
	    var resolution = new Three.Vector2(width * 2, height * 2);

	    var _this = possibleConstructorReturn(this, (BloomPass.__proto__ || Object.getPrototypeOf(BloomPass)).call(this, resolution, strength, radius, threshold));

	    _this.needsSeparateRender = false;
	    _this.separateCamera = null;
	    _this.separateScene = null;
	    _this.layers = new Three.Layers();
	    return _this;
	  }

	  createClass(BloomPass, [{
	    key: 'render',
	    value: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {
	      var autoClear = renderer.autoClear;

	      renderer.autoClear = false;
	      var clearColor = renderer.getClearColor().getHex();
	      var clearAlpha = renderer.getClearAlpha();
	      renderer.setClearColor(new Three.Color(0, 0, 0), 0);
	      if (maskActive) {
	        renderer.context.disable(renderer.context.STENCIL_TEST);
	      }

	      // 1. Extract Bright Areas
	      if (this.needsSeparateRender) {
	        // Use the write buffer to render the separate scene to
	        var camera = this.separateCamera,
	            scene = this.separateScene;
	        var layers = camera.layers;

	        camera.layers = this.layers;
	        renderer.render(scene, camera, writeBuffer, true);
	        camera.layers = layers;
	        this.highPassUniforms.tDiffuse.value = writeBuffer.texture;
	      } else {
	        this.highPassUniforms.tDiffuse.value = readBuffer.texture;
	      }
	      this.highPassUniforms.luminosityThreshold.value = this.threshold;
	      this.quad.material = this.materialHighPassFilter;
	      renderer.render(this.scene, this.camera, this.renderTargetBright, true);

	      // 2. Blur all the mips progressively
	      var renderTarget = this.renderTargetBright;
	      for (var i = 0; i < this.nMips; ++i) {
	        var material = this.separableBlurMaterials[i];
	        var _horizontalRenderTarget = this.renderTargetsHorizontal[i];
	        var verticalRenderTarget = this.renderTargetsVertical[i];
	        this.quad.material = material;
	        material.uniforms.colorTexture.value = renderTarget.texture;
	        material.uniforms.direction.value = this.constructor.BlurDirectionX;
	        renderer.render(this.scene, this.camera, _horizontalRenderTarget, true);
	        material.uniforms.colorTexture.value = _horizontalRenderTarget.texture;
	        material.uniforms.direction.value = this.constructor.BlurDirectionY;
	        renderer.render(this.scene, this.camera, verticalRenderTarget, true);
	        renderTarget = verticalRenderTarget;
	      }

	      // Composite all the mips
	      var horizontalRenderTarget = this.renderTargetsHorizontal[0];
	      this.quad.material = this.compositeMaterial;
	      this.compositeMaterial.uniforms.bloomStrength.value = this.strength;
	      this.compositeMaterial.uniforms.bloomRadius.value = this.radius;
	      this.compositeMaterial.uniforms.bloomTintColors.value = this.bloomTintColors;
	      renderer.render(this.scene, this.camera, horizontalRenderTarget, true);

	      // Blend it additively over the input texture
	      this.quad.material = this.materialCopy;
	      this.copyUniforms.tDiffuse.value = horizontalRenderTarget.texture;

	      if (maskActive) {
	        renderer.context.enable(renderer.context.STENCIL_TEST);
	      }
	      if (this.renderToScreen) {
	        renderer.render(this.scene, this.camera, undefined, false);
	      } else {
	        renderer.render(this.scene, this.camera, readBuffer, false);
	      }

	      renderer.autoClear = autoClear;
	      if (this.clearColor) {
	        renderer.setClearColor(clearColor, clearAlpha);
	      }
	    }
	  }, {
	    key: 'setSize',
	    value: function setSize(width, height) {
	      // The same discussion in the constructor
	      get(BloomPass.prototype.__proto__ || Object.getPrototypeOf(BloomPass.prototype), 'setSize', this).call(this, width * 2, height * 2);
	    }
	  }]);
	  return BloomPass;
	}(Three.UnrealBloomPass);

	// The MIT License

	var ClearScissorPass = function (_Three$Pass) {
	  inherits(ClearScissorPass, _Three$Pass);

	  function ClearScissorPass() {
	    classCallCheck(this, ClearScissorPass);

	    var _this = possibleConstructorReturn(this, (ClearScissorPass.__proto__ || Object.getPrototypeOf(ClearScissorPass)).call(this));

	    _this.needsSwap = false;
	    return _this;
	  }

	  createClass(ClearScissorPass, [{
	    key: 'render',
	    value: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {
	      readBuffer.scissorTest = false;
	      writeBuffer.scissorTest = false;
	    }
	  }]);
	  return ClearScissorPass;
	}(Three.Pass);

	var fragmentShader = "#define GLSLIFY 1\n// The MIT License\n// Copyright (C) 2016-Present Shota Matsuda\n\n#define FXAA_GLSL_100 1\n#define FXAA_GREEN_AS_LUMA 1\n\n//\n//  File:        es3-kepler\\FXAA/FXAA3_11.h\n//  SDK Version: v3.00\n//  Email:       gameworks@nvidia.com\n//  Site:        http://developer.nvidia.com/\n//\n//  Copyright (c) 2014-2015, NVIDIA CORPORATION. All rights reserved.\n//\n//  Redistribution and use in source and binary forms, with or without\n//  modification, are permitted provided that the following conditions\n//  are met:\n//   * Redistributions of source code must retain the above copyright\n//     notice, this list of conditions and the following disclaimer.\n//   * Redistributions in binary form must reproduce the above copyright\n//     notice, this list of conditions and the following disclaimer in the\n//     documentation and/or other materials provided with the distribution.\n//   * Neither the name of NVIDIA CORPORATION nor the names of its\n//     contributors may be used to endorse or promote products derived\n//     from this software without specific prior written permission.\n//\n//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ``AS IS'' AND ANY\n//  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE\n//  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR\n//  PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR\n//  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,\n//  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,\n//  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR\n//  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY\n//  OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT\n//  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE\n//  OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\n//\n\n#ifndef FXAA_GLSL_100\n  #define FXAA_GLSL_100 0\n#endif\n\n#ifndef FXAA_GLSL_120\n  #define FXAA_GLSL_120 0\n#endif\n\n#ifndef FXAA_GLSL_130\n  #define FXAA_GLSL_130 0\n#endif\n\n// -----------------------------------------------------------------------------\n\n// For those using non-linear color, and either not able to get luma in alpha,\n// or not wanting to, this enables FXAA to run using green as a proxy for luma.\n// So with this enabled, no need to pack luma in alpha.\n//\n// This will turn off AA on anything which lacks some amount of green. Pure red\n// and blue or combination of only R and B, will get no AA.\n//\n// Might want to lower the settings for both,\n//   fxaaConsoleEdgeThresholdMin\n//   fxaaQualityEdgeThresholdMin\n// In order to insure AA does not get turned off on colors which contain a minor\n// amount of green.\n//\n// 1 = On\n// 0 = Off\n#ifndef FXAA_GREEN_AS_LUMA\n  #define FXAA_GREEN_AS_LUMA 0\n#endif\n\n// Probably will not work when FXAA_GREEN_AS_LUMA = 1.\n// 1 = Use discard on pixels which don't need AA. For APIs which enable\n//     concurrent TEX+ROP from same surface.\n// 0 = Return unchanged color on pixels which don't need AA.\n#ifndef FXAA_DISCARD\n  #define FXAA_DISCARD 0\n#endif\n\n// Used for GLSL 120 only.\n//\n// 1 = GL API supports fast pixel offsets\n// 0 = do not use fast pixel offsets\n#ifndef FXAA_FAST_PIXEL_OFFSET\n  #ifdef GL_EXT_gpu_shader4\n    #define FXAA_FAST_PIXEL_OFFSET 1\n  #endif\n  #ifdef GL_NV_gpu_shader5\n    #define FXAA_FAST_PIXEL_OFFSET 1\n  #endif\n  #ifdef GL_ARB_gpu_shader5\n    #define FXAA_FAST_PIXEL_OFFSET 1\n  #endif\n  #ifndef FXAA_FAST_PIXEL_OFFSET\n    #define FXAA_FAST_PIXEL_OFFSET 0\n  #endif\n#endif\n\n// 1 = API supports gather4 on alpha channel.\n// 0 = API does not support gather4 on alpha channel.\n#ifndef FXAA_GATHER4_ALPHA\n  #ifdef GL_ARB_gpu_shader5\n    #define FXAA_GATHER4_ALPHA 1\n  #endif\n  #ifdef GL_NV_gpu_shader5\n    #define FXAA_GATHER4_ALPHA 1\n  #endif\n  #ifndef FXAA_GATHER4_ALPHA\n    #define FXAA_GATHER4_ALPHA 0\n  #endif\n#endif\n\n// -----------------------------------------------------------------------------\n//  FXAA QUALITY - TUNING KNOBS\n// -----------------------------------------------------------------------------\n\n// Choose the quality preset. This needs to be compiled into the shader as it\n// effects code. Best option to include multiple presets is to in each shader\n// define the preset, then include this file.\n//\n// OPTIONS\n// 10 to 15 - default medium dither (10 = fastest, 15 = highest quality)\n// 20 to 29 - less dither, more expensive (20 = fastest, 29 = highest quality)\n// 39       - no dither, very expensive\n//\n// NOTES\n// 12 = slightly faster then FXAA 3.9 and higher edge quality (default)\n// 13 = about same speed as FXAA 3.9 and better than 12\n// 23 = closest to FXAA 3.9 visually and performance wise\n//  _ = the lowest digit is directly related to performance\n// _  = the highest digit is directly related to style\n#ifndef FXAA_QUALITY_PRESET\n  #define FXAA_QUALITY_PRESET 12\n#endif\n\n// -----------------------------------------------------------------------------\n//  FXAA QUALITY - PRESETS\n\n// -----------------------------------------------------------------------------\n//  FXAA QUALITY - MEDIUM DITHER PRESETS\n\n#if (FXAA_QUALITY_PRESET == 10)\n  #define FXAA_QUALITY_PS 3\n  #define FXAA_QUALITY_P0 1.5\n  #define FXAA_QUALITY_P1 3.0\n  #define FXAA_QUALITY_P2 12.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 11)\n  #define FXAA_QUALITY_PS 4\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 3.0\n  #define FXAA_QUALITY_P3 12.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 12)\n  #define FXAA_QUALITY_PS 5\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 4.0\n  #define FXAA_QUALITY_P4 12.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 13)\n  #define FXAA_QUALITY_PS 6\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 4.0\n  #define FXAA_QUALITY_P5 12.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 14)\n  #define FXAA_QUALITY_PS 7\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 4.0\n  #define FXAA_QUALITY_P6 12.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 15)\n  #define FXAA_QUALITY_PS 8\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 4.0\n  #define FXAA_QUALITY_P7 12.0\n#endif\n\n// -----------------------------------------------------------------------------\n//  FXAA QUALITY - LOW DITHER PRESETS\n\n#if (FXAA_QUALITY_PRESET == 20)\n  #define FXAA_QUALITY_PS 3\n  #define FXAA_QUALITY_P0 1.5\n  #define FXAA_QUALITY_P1 2.0\n  #define FXAA_QUALITY_P2 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 21)\n  #define FXAA_QUALITY_PS 4\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 22)\n  #define FXAA_QUALITY_PS 5\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 23)\n  #define FXAA_QUALITY_PS 6\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 24)\n  #define FXAA_QUALITY_PS 7\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 3.0\n  #define FXAA_QUALITY_P6 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 25)\n  #define FXAA_QUALITY_PS 8\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 4.0\n  #define FXAA_QUALITY_P7 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 26)\n  #define FXAA_QUALITY_PS 9\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 2.0\n  #define FXAA_QUALITY_P7 4.0\n  #define FXAA_QUALITY_P8 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 27)\n  #define FXAA_QUALITY_PS 10\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 2.0\n  #define FXAA_QUALITY_P7 2.0\n  #define FXAA_QUALITY_P8 4.0\n  #define FXAA_QUALITY_P9 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 28)\n  #define FXAA_QUALITY_PS 11\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 2.0\n  #define FXAA_QUALITY_P7 2.0\n  #define FXAA_QUALITY_P8 2.0\n  #define FXAA_QUALITY_P9 4.0\n  #define FXAA_QUALITY_P10 8.0\n#endif\n\n#if (FXAA_QUALITY_PRESET == 29)\n  #define FXAA_QUALITY_PS 12\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.5\n  #define FXAA_QUALITY_P2 2.0\n  #define FXAA_QUALITY_P3 2.0\n  #define FXAA_QUALITY_P4 2.0\n  #define FXAA_QUALITY_P5 2.0\n  #define FXAA_QUALITY_P6 2.0\n  #define FXAA_QUALITY_P7 2.0\n  #define FXAA_QUALITY_P8 2.0\n  #define FXAA_QUALITY_P9 2.0\n  #define FXAA_QUALITY_P10 4.0\n  #define FXAA_QUALITY_P11 8.0\n#endif\n\n// -----------------------------------------------------------------------------\n//  FXAA QUALITY - EXTREME QUALITY\n\n#if (FXAA_QUALITY_PRESET == 39)\n  #define FXAA_QUALITY_PS 12\n  #define FXAA_QUALITY_P0 1.0\n  #define FXAA_QUALITY_P1 1.0\n  #define FXAA_QUALITY_P2 1.0\n  #define FXAA_QUALITY_P3 1.0\n  #define FXAA_QUALITY_P4 1.0\n  #define FXAA_QUALITY_P5 1.5\n  #define FXAA_QUALITY_P6 2.0\n  #define FXAA_QUALITY_P7 2.0\n  #define FXAA_QUALITY_P8 2.0\n  #define FXAA_QUALITY_P9 2.0\n  #define FXAA_QUALITY_P10 4.0\n  #define FXAA_QUALITY_P11 8.0\n#endif\n\n// -----------------------------------------------------------------------------\n//  API PORTING\n\n#if (FXAA_GLSL_100 == 1) || (FXAA_GLSL_120 == 1) || (FXAA_GLSL_130 == 1)\n  #define FxaaBool bool\n  #define FxaaDiscard discard\n  #define FxaaFloat float\n  #define FxaaFloat2 vec2\n  #define FxaaFloat3 vec3\n  #define FxaaFloat4 vec4\n  #define FxaaHalf float\n  #define FxaaHalf2 vec2\n  #define FxaaHalf3 vec3\n  #define FxaaHalf4 vec4\n  #define FxaaInt2 ivec2\n  #define FxaaSat(x) clamp(x, 0.0, 1.0)\n  #define FxaaTex sampler2D\n#else\n  #define FxaaBool bool\n  #define FxaaDiscard clip(-1)\n  #define FxaaFloat float\n  #define FxaaFloat2 float2\n  #define FxaaFloat3 float3\n  #define FxaaFloat4 float4\n  #define FxaaHalf half\n  #define FxaaHalf2 half2\n  #define FxaaHalf3 half3\n  #define FxaaHalf4 half4\n  #define FxaaSat(x) saturate(x)\n#endif\n\n// -----------------------------------------------------------------------------\n\n#if (FXAA_GLSL_100 == 1)\n  #define FxaaTexTop(t, p) texture2D(t, p, 0.0)\n  #define FxaaTexOff(t, p, o, r) texture2D(t, p + (o * r), 0.0)\n#endif\n\n// -----------------------------------------------------------------------------\n\n#if (FXAA_GLSL_120 == 1)\n  // Requires,\n  //  #version 120\n  // And at least,\n  //  #extension GL_EXT_gpu_shader4 : enable\n  //  (or set FXAA_FAST_PIXEL_OFFSET 1 to work like DX9)\n  #define FxaaTexTop(t, p) texture2DLod(t, p, 0.0)\n  #if (FXAA_FAST_PIXEL_OFFSET == 1)\n    #define FxaaTexOff(t, p, o, r) texture2DLodOffset(t, p, 0.0, o)\n  #else\n    #define FxaaTexOff(t, p, o, r) texture2DLod(t, p + (o * r), 0.0)\n  #endif\n  #if (FXAA_GATHER4_ALPHA == 1)\n    // use #extension GL_ARB_gpu_shader5 : enable\n    #define FxaaTexAlpha4(t, p) textureGather(t, p, 3)\n    #define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)\n    #define FxaaTexGreen4(t, p) textureGather(t, p, 1)\n    #define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)\n  #endif\n#endif\n\n// -----------------------------------------------------------------------------\n\n#if (FXAA_GLSL_130 == 1)\n  // Requires \"#version 130\" or better\n  #define FxaaTexTop(t, p) textureLod(t, p, 0.0)\n  #define FxaaTexOff(t, p, o, r) textureLodOffset(t, p, 0.0, o)\n  #if (FXAA_GATHER4_ALPHA == 1)\n    // use #extension GL_ARB_gpu_shader5 : enable\n    #define FxaaTexAlpha4(t, p) textureGather(t, p, 3)\n    #define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)\n    #define FxaaTexGreen4(t, p) textureGather(t, p, 1)\n    #define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)\n  #endif\n#endif\n\n// -----------------------------------------------------------------------------\n//  GREEN AS LUMA OPTION SUPPORT FUNCTION\n\n#if (FXAA_GREEN_AS_LUMA == 0)\n  FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.w; }\n#else\n  FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.y; }\n#endif\n\n// -----------------------------------------------------------------------------\n//  FXAA3 QUALITY - PC\n\nFxaaFloat4 FxaaPixelShader(\n  // Use noperspective interpolation here (turn off perspective interpolation).\n  // {xy} = center of pixel\n  FxaaFloat2 pos,\n\n  // Input color texture.\n  // {rgb_} = color in linear or perceptual color space\n  // if (FXAA_GREEN_AS_LUMA == 0)\n  //   {___a} = luma in perceptual color space (not linear)\n  FxaaTex tex,\n\n  // Only used on FXAA Quality.\n  // This must be from a constant/uniform.\n  // {x_} = 1.0/screenWidthInPixels\n  // {_y} = 1.0/screenHeightInPixels\n  FxaaFloat2 fxaaQualityRcpFrame,\n\n  // Only used on FXAA Quality.\n  // This used to be the FXAA_QUALITY_SUBPIX define.\n  // It is here now to allow easier tuning.\n  // Choose the amount of sub-pixel aliasing removal.\n  // This can effect sharpness.\n  //   1.00 - upper limit (softer)\n  //   0.75 - default amount of filtering\n  //   0.50 - lower limit (sharper, less sub-pixel aliasing removal)\n  //   0.25 - almost off\n  //   0.00 - completely off\n  FxaaFloat fxaaQualitySubpix,\n\n  // Only used on FXAA Quality.\n  // This used to be the FXAA_QUALITY_EDGE_THRESHOLD define.\n  // It is here now to allow easier tuning.\n  // The minimum amount of local contrast required to apply algorithm.\n  //   0.333 - too little (faster)\n  //   0.250 - low quality\n  //   0.166 - default\n  //   0.125 - high quality\n  //   0.063 - overkill (slower)\n  FxaaFloat fxaaQualityEdgeThreshold,\n\n  // Only used on FXAA Quality.\n  // This used to be the FXAA_QUALITY_EDGE_THRESHOLD_MIN define.\n  // It is here now to allow easier tuning.\n  // Trims the algorithm from processing darks.\n  //   0.0833 - upper limit (default, the start of visible unfiltered edges)\n  //   0.0625 - high quality (faster)\n  //   0.0312 - visible limit (slower)\n  // Special notes when using FXAA_GREEN_AS_LUMA,\n  //   Likely want to set this to zero.\n  //   As colors that are mostly not-green\n  //   will appear very dark in the green channel!\n  //   Tune by looking at mostly non-green content,\n  //   then start at zero and increase until aliasing is a problem.\n  FxaaFloat fxaaQualityEdgeThresholdMin\n) {\n// -----------------------------------------------------------------------------\n  FxaaFloat2 posM;\n  posM.x = pos.x;\n  posM.y = pos.y;\n  #if (FXAA_GATHER4_ALPHA == 1)\n    #if (FXAA_DISCARD == 0)\n      FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);\n      #if (FXAA_GREEN_AS_LUMA == 0)\n        #define lumaM rgbyM.w\n      #else\n        #define lumaM rgbyM.y\n      #endif\n    #endif\n    #if (FXAA_GREEN_AS_LUMA == 0)\n      FxaaFloat4 luma4A = FxaaTexAlpha4(tex, posM);\n      FxaaFloat4 luma4B = FxaaTexOffAlpha4(tex, posM, FxaaInt2(-1, -1));\n    #else\n      FxaaFloat4 luma4A = FxaaTexGreen4(tex, posM);\n      FxaaFloat4 luma4B = FxaaTexOffGreen4(tex, posM, FxaaInt2(-1, -1));\n    #endif\n    #if (FXAA_DISCARD == 1)\n      #define lumaM luma4A.w\n    #endif\n    #define lumaE luma4A.z\n    #define lumaS luma4A.x\n    #define lumaSE luma4A.y\n    #define lumaNW luma4B.w\n    #define lumaN luma4B.z\n    #define lumaW luma4B.x\n  #else\n    FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);\n    #if (FXAA_GREEN_AS_LUMA == 0)\n      #define lumaM rgbyM.w\n    #else\n      #define lumaM rgbyM.y\n    #endif\n      #if (FXAA_GLSL_100 == 1)\n        FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0, 1.0), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 0.0), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0,-1.0), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 0.0), fxaaQualityRcpFrame.xy));\n      #else\n        FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0, 1), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 0), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0,-1), fxaaQualityRcpFrame.xy));\n        FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 0), fxaaQualityRcpFrame.xy));\n      #endif\n  #endif\n// -----------------------------------------------------------------------------\n  FxaaFloat maxSM = max(lumaS, lumaM);\n  FxaaFloat minSM = min(lumaS, lumaM);\n  FxaaFloat maxESM = max(lumaE, maxSM);\n  FxaaFloat minESM = min(lumaE, minSM);\n  FxaaFloat maxWN = max(lumaN, lumaW);\n  FxaaFloat minWN = min(lumaN, lumaW);\n  FxaaFloat rangeMax = max(maxWN, maxESM);\n  FxaaFloat rangeMin = min(minWN, minESM);\n  FxaaFloat rangeMaxScaled = rangeMax * fxaaQualityEdgeThreshold;\n  FxaaFloat range = rangeMax - rangeMin;\n  FxaaFloat rangeMaxClamped = max(fxaaQualityEdgeThresholdMin, rangeMaxScaled);\n  FxaaBool earlyExit = range < rangeMaxClamped;\n// -----------------------------------------------------------------------------\n  if(earlyExit)\n    #if (FXAA_DISCARD == 1)\n      FxaaDiscard;\n    #else\n      return rgbyM;\n    #endif\n// -----------------------------------------------------------------------------\n  #if (FXAA_GATHER4_ALPHA == 0)\n    #if (FXAA_GLSL_100 == 1)\n      FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0,-1.0), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 1.0), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0,-1.0), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 1.0), fxaaQualityRcpFrame.xy));\n    #else\n      FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1,-1), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 1), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1,-1), fxaaQualityRcpFrame.xy));\n      FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));\n    #endif\n  #else\n    FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(1, -1), fxaaQualityRcpFrame.xy));\n    FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));\n  #endif\n// -----------------------------------------------------------------------------\n  FxaaFloat lumaNS = lumaN + lumaS;\n  FxaaFloat lumaWE = lumaW + lumaE;\n  FxaaFloat subpixRcpRange = 1.0/range;\n  FxaaFloat subpixNSWE = lumaNS + lumaWE;\n  FxaaFloat edgeHorz1 = (-2.0 * lumaM) + lumaNS;\n  FxaaFloat edgeVert1 = (-2.0 * lumaM) + lumaWE;\n// -----------------------------------------------------------------------------\n  FxaaFloat lumaNESE = lumaNE + lumaSE;\n  FxaaFloat lumaNWNE = lumaNW + lumaNE;\n  FxaaFloat edgeHorz2 = (-2.0 * lumaE) + lumaNESE;\n  FxaaFloat edgeVert2 = (-2.0 * lumaN) + lumaNWNE;\n// -----------------------------------------------------------------------------\n  FxaaFloat lumaNWSW = lumaNW + lumaSW;\n  FxaaFloat lumaSWSE = lumaSW + lumaSE;\n  FxaaFloat edgeHorz4 = (abs(edgeHorz1) * 2.0) + abs(edgeHorz2);\n  FxaaFloat edgeVert4 = (abs(edgeVert1) * 2.0) + abs(edgeVert2);\n  FxaaFloat edgeHorz3 = (-2.0 * lumaW) + lumaNWSW;\n  FxaaFloat edgeVert3 = (-2.0 * lumaS) + lumaSWSE;\n  FxaaFloat edgeHorz = abs(edgeHorz3) + edgeHorz4;\n  FxaaFloat edgeVert = abs(edgeVert3) + edgeVert4;\n// -----------------------------------------------------------------------------\n  FxaaFloat subpixNWSWNESE = lumaNWSW + lumaNESE;\n  FxaaFloat lengthSign = fxaaQualityRcpFrame.x;\n  FxaaBool horzSpan = edgeHorz >= edgeVert;\n  FxaaFloat subpixA = subpixNSWE * 2.0 + subpixNWSWNESE;\n// -----------------------------------------------------------------------------\n  if(!horzSpan) lumaN = lumaW;\n  if(!horzSpan) lumaS = lumaE;\n  if(horzSpan) lengthSign = fxaaQualityRcpFrame.y;\n  FxaaFloat subpixB = (subpixA * (1.0/12.0)) - lumaM;\n// -----------------------------------------------------------------------------\n  FxaaFloat gradientN = lumaN - lumaM;\n  FxaaFloat gradientS = lumaS - lumaM;\n  FxaaFloat lumaNN = lumaN + lumaM;\n  FxaaFloat lumaSS = lumaS + lumaM;\n  FxaaBool pairN = abs(gradientN) >= abs(gradientS);\n  FxaaFloat gradient = max(abs(gradientN), abs(gradientS));\n  if(pairN) lengthSign = -lengthSign;\n  FxaaFloat subpixC = FxaaSat(abs(subpixB) * subpixRcpRange);\n// -----------------------------------------------------------------------------\n  FxaaFloat2 posB;\n  posB.x = posM.x;\n  posB.y = posM.y;\n  FxaaFloat2 offNP;\n  offNP.x = (!horzSpan) ? 0.0 : fxaaQualityRcpFrame.x;\n  offNP.y = ( horzSpan) ? 0.0 : fxaaQualityRcpFrame.y;\n  if(!horzSpan) posB.x += lengthSign * 0.5;\n  if( horzSpan) posB.y += lengthSign * 0.5;\n// -----------------------------------------------------------------------------\n  FxaaFloat2 posN;\n  posN.x = posB.x - offNP.x * FXAA_QUALITY_P0;\n  posN.y = posB.y - offNP.y * FXAA_QUALITY_P0;\n  FxaaFloat2 posP;\n  posP.x = posB.x + offNP.x * FXAA_QUALITY_P0;\n  posP.y = posB.y + offNP.y * FXAA_QUALITY_P0;\n  FxaaFloat subpixD = ((-2.0)*subpixC) + 3.0;\n  FxaaFloat lumaEndN = FxaaLuma(FxaaTexTop(tex, posN));\n  FxaaFloat subpixE = subpixC * subpixC;\n  FxaaFloat lumaEndP = FxaaLuma(FxaaTexTop(tex, posP));\n// -----------------------------------------------------------------------------\n  if(!pairN) lumaNN = lumaSS;\n  FxaaFloat gradientScaled = gradient * 1.0/4.0;\n  FxaaFloat lumaMM = lumaM - lumaNN * 0.5;\n  FxaaFloat subpixF = subpixD * subpixE;\n  FxaaBool lumaMLTZero = lumaMM < 0.0;\n// -----------------------------------------------------------------------------\n  lumaEndN -= lumaNN * 0.5;\n  lumaEndP -= lumaNN * 0.5;\n  FxaaBool doneN = abs(lumaEndN) >= gradientScaled;\n  FxaaBool doneP = abs(lumaEndP) >= gradientScaled;\n  if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P1;\n  if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P1;\n  FxaaBool doneNP = (!doneN) || (!doneP);\n  if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P1;\n  if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P1;\n// -----------------------------------------------------------------------------\n  if(doneNP) {\n    if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n    if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n    if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n    if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n    doneN = abs(lumaEndN) >= gradientScaled;\n    doneP = abs(lumaEndP) >= gradientScaled;\n    if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P2;\n    if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P2;\n    doneNP = (!doneN) || (!doneP);\n    if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P2;\n    if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P2;\n// -----------------------------------------------------------------------------\n    #if (FXAA_QUALITY_PS > 3)\n    if(doneNP) {\n      if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n      if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n      if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n      if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n      doneN = abs(lumaEndN) >= gradientScaled;\n      doneP = abs(lumaEndP) >= gradientScaled;\n      if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P3;\n      if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P3;\n      doneNP = (!doneN) || (!doneP);\n      if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P3;\n      if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P3;\n// -----------------------------------------------------------------------------\n      #if (FXAA_QUALITY_PS > 4)\n      if(doneNP) {\n        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n        doneN = abs(lumaEndN) >= gradientScaled;\n        doneP = abs(lumaEndP) >= gradientScaled;\n        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P4;\n        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P4;\n        doneNP = (!doneN) || (!doneP);\n        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P4;\n        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P4;\n// -----------------------------------------------------------------------------\n        #if (FXAA_QUALITY_PS > 5)\n        if(doneNP) {\n          if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n          if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n          if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n          if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n          doneN = abs(lumaEndN) >= gradientScaled;\n          doneP = abs(lumaEndP) >= gradientScaled;\n          if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P5;\n          if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P5;\n          doneNP = (!doneN) || (!doneP);\n          if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P5;\n          if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P5;\n// -----------------------------------------------------------------------------\n          #if (FXAA_QUALITY_PS > 6)\n          if(doneNP) {\n            if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n            if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n            if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n            if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n            doneN = abs(lumaEndN) >= gradientScaled;\n            doneP = abs(lumaEndP) >= gradientScaled;\n            if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P6;\n            if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P6;\n            doneNP = (!doneN) || (!doneP);\n            if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P6;\n            if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P6;\n// -----------------------------------------------------------------------------\n            #if (FXAA_QUALITY_PS > 7)\n            if(doneNP) {\n              if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n              if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n              if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n              if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n              doneN = abs(lumaEndN) >= gradientScaled;\n              doneP = abs(lumaEndP) >= gradientScaled;\n              if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P7;\n              if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P7;\n              doneNP = (!doneN) || (!doneP);\n              if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P7;\n              if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P7;\n// -----------------------------------------------------------------------------\n  #if (FXAA_QUALITY_PS > 8)\n  if(doneNP) {\n    if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n    if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n    if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n    if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n    doneN = abs(lumaEndN) >= gradientScaled;\n    doneP = abs(lumaEndP) >= gradientScaled;\n    if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P8;\n    if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P8;\n    doneNP = (!doneN) || (!doneP);\n    if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P8;\n    if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P8;\n// -----------------------------------------------------------------------------\n    #if (FXAA_QUALITY_PS > 9)\n    if(doneNP) {\n      if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n      if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n      if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n      if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n      doneN = abs(lumaEndN) >= gradientScaled;\n      doneP = abs(lumaEndP) >= gradientScaled;\n      if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P9;\n      if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P9;\n      doneNP = (!doneN) || (!doneP);\n      if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P9;\n      if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P9;\n// -----------------------------------------------------------------------------\n      #if (FXAA_QUALITY_PS > 10)\n      if(doneNP) {\n        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n        doneN = abs(lumaEndN) >= gradientScaled;\n        doneP = abs(lumaEndP) >= gradientScaled;\n        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P10;\n        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P10;\n        doneNP = (!doneN) || (!doneP);\n        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P10;\n        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P10;\n// -----------------------------------------------------------------------------\n        #if (FXAA_QUALITY_PS > 11)\n        if(doneNP) {\n          if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n          if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n          if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n          if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n          doneN = abs(lumaEndN) >= gradientScaled;\n          doneP = abs(lumaEndP) >= gradientScaled;\n          if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P11;\n          if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P11;\n          doneNP = (!doneN) || (!doneP);\n          if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P11;\n          if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P11;\n// -----------------------------------------------------------------------------\n          #if (FXAA_QUALITY_PS > 12)\n          if(doneNP) {\n            if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));\n            if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));\n            if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;\n            if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;\n            doneN = abs(lumaEndN) >= gradientScaled;\n            doneP = abs(lumaEndP) >= gradientScaled;\n            if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P12_1540259130;\n            if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P12_1540259130;\n            doneNP = (!doneN) || (!doneP);\n            if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P12_1540259130;\n            if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P12_1540259130;\n// -----------------------------------------------------------------------------\n          }\n          #endif\n// -----------------------------------------------------------------------------\n        }\n        #endif\n// -----------------------------------------------------------------------------\n      }\n      #endif\n// -----------------------------------------------------------------------------\n    }\n    #endif\n// -----------------------------------------------------------------------------\n  }\n  #endif\n// -----------------------------------------------------------------------------\n            }\n            #endif\n// -----------------------------------------------------------------------------\n          }\n          #endif\n// -----------------------------------------------------------------------------\n        }\n        #endif\n// -----------------------------------------------------------------------------\n      }\n      #endif\n// -----------------------------------------------------------------------------\n    }\n    #endif\n// -----------------------------------------------------------------------------\n  }\n// -----------------------------------------------------------------------------\n  FxaaFloat dstN = posM.x - posN.x;\n  FxaaFloat dstP = posP.x - posM.x;\n  if(!horzSpan) dstN = posM.y - posN.y;\n  if(!horzSpan) dstP = posP.y - posM.y;\n// -----------------------------------------------------------------------------\n  FxaaBool goodSpanN = (lumaEndN < 0.0) != lumaMLTZero;\n  FxaaFloat spanLength = (dstP + dstN);\n  FxaaBool goodSpanP = (lumaEndP < 0.0) != lumaMLTZero;\n  FxaaFloat spanLengthRcp = 1.0/spanLength;\n// -----------------------------------------------------------------------------\n  FxaaBool directionN = dstN < dstP;\n  FxaaFloat dst = min(dstN, dstP);\n  FxaaBool goodSpan = directionN ? goodSpanN : goodSpanP;\n  FxaaFloat subpixG = subpixF * subpixF;\n  FxaaFloat pixelOffset = (dst * (-spanLengthRcp)) + 0.5;\n  FxaaFloat subpixH = subpixG * fxaaQualitySubpix;\n// -----------------------------------------------------------------------------\n  FxaaFloat pixelOffsetGood = goodSpan ? pixelOffset : 0.0;\n  FxaaFloat pixelOffsetSubpix = max(pixelOffsetGood, subpixH);\n  if(!horzSpan) posM.x += pixelOffsetSubpix * lengthSign;\n  if( horzSpan) posM.y += pixelOffsetSubpix * lengthSign;\n  #if (FXAA_DISCARD == 1)\n    return FxaaTexTop(tex, posM);\n  #else\n    return FxaaFloat4(FxaaTexTop(tex, posM).xyz, lumaM);\n  #endif\n}\n\nuniform sampler2D tDiffuse;\nuniform vec2 resolution;\nuniform float subpix;\nuniform float edgeThreshold;\nuniform float edgeThresholdMin;\n\nvarying vec2 vUv;\n\nvoid main() {\n  gl_FragColor = FxaaPixelShader(\n      vUv,\n      tDiffuse,\n      resolution,\n      subpix,\n      edgeThreshold,\n      edgeThresholdMin);\n}\n";

	// The MIT License

	var ShaderPass = function (_Three$Pass) {
	  inherits(ShaderPass, _Three$Pass);

	  function ShaderPass(shader) {
	    var textureId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'tDiffuse';
	    classCallCheck(this, ShaderPass);

	    var _this = possibleConstructorReturn(this, (ShaderPass.__proto__ || Object.getPrototypeOf(ShaderPass)).call(this));

	    _this.textureId = textureId;
	    if (shader instanceof Three.ShaderMaterial) {
	      _this.uniforms = shader.uniforms;
	      _this.material = shader.clone();
	    } else if (shader) {
	      _this.uniforms = Three.UniformsUtils.clone(shader.uniforms);
	      _this.material = new Three.ShaderMaterial({
	        defines: shader.defines || {},
	        uniforms: _this.uniforms,
	        vertexShader: shader.vertexShader,
	        fragmentShader: shader.fragmentShader
	      });
	    }
	    _this.camera = new Three.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	    _this.scene = new Three.Scene();
	    var geometry = new Three.PlaneBufferGeometry(2, 2);
	    _this.quad = new Three.Mesh(geometry, _this.material);
	    _this.quad.frustumCulled = false;
	    _this.scene.add(_this.quad);
	    return _this;
	  }

	  createClass(ShaderPass, [{
	    key: 'dispose',
	    value: function dispose() {
	      this.material.dispose();
	    }
	  }, {
	    key: 'render',
	    value: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {
	      var scene = this.scene,
	          camera = this.camera;

	      if (this.uniforms[this.textureId]) {
	        this.uniforms[this.textureId].value = readBuffer.texture;
	      }
	      if (this.renderToScreen) {
	        renderer.render(scene, camera, undefined, this.clear);
	      } else {
	        renderer.render(scene, camera, writeBuffer, this.clear);
	      }
	    }
	  }]);
	  return ShaderPass;
	}(Three.Pass);

	var vertexShader = "#define GLSLIFY 1\n// The MIT License\n// Copyright (C) 2016-Present Shota Matsuda\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

	// The MIT License

	var FXAAPass = function (_ShaderPass) {
	  inherits(FXAAPass, _ShaderPass);

	  function FXAAPass() {
	    var width = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 256;
	    var height = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 256;
	    var pixelRatio = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
	    var quality = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 12;

	    var _ref = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {},
	        _ref$subpix = _ref.subpix,
	        subpix = _ref$subpix === undefined ? 0.75 : _ref$subpix,
	        _ref$edgeThreshold = _ref.edgeThreshold,
	        edgeThreshold = _ref$edgeThreshold === undefined ? 0.125 : _ref$edgeThreshold,
	        _ref$edgeThresholdMin = _ref.edgeThresholdMin,
	        edgeThresholdMin = _ref$edgeThresholdMin === undefined ? 0.0625 : _ref$edgeThresholdMin;

	    classCallCheck(this, FXAAPass);

	    var deviceWidth = width * pixelRatio;
	    var deviceHeight = height * pixelRatio;
	    return possibleConstructorReturn(this, (FXAAPass.__proto__ || Object.getPrototypeOf(FXAAPass)).call(this, {
	      defines: {
	        FXAA_QUALITY_PRESET: quality
	      },
	      uniforms: {
	        tDiffuse: { value: null },
	        resolution: {
	          value: new Three.Vector2(1 / deviceWidth, 1 / deviceHeight)
	        },
	        subpix: { value: subpix },
	        edgeThreshold: { value: edgeThreshold },
	        edgeThresholdMin: { value: edgeThresholdMin }
	      },
	      vertexShader: vertexShader,
	      fragmentShader: fragmentShader
	    }));
	  }

	  createClass(FXAAPass, [{
	    key: 'setSize',
	    value: function setSize(width, height) {
	      var pixelRatio = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;

	      var deviceWidth = width * pixelRatio;
	      var deviceHeight = height * pixelRatio;
	      this.uniforms.resolution.value.set(1 / deviceWidth, 1 / deviceHeight);
	    }
	  }, {
	    key: 'subpix',
	    get: function get$$1() {
	      return this.uniforms.subpix.value;
	    },
	    set: function set$$1(value) {
	      this.uniforms.subpix.value = value;
	    }
	  }, {
	    key: 'edgeThreshold',
	    get: function get$$1() {
	      return this.uniforms.edgeThreshold.value;
	    },
	    set: function set$$1(value) {
	      this.uniforms.edgeThreshold.value = value;
	    }
	  }, {
	    key: 'edgeThresholdMin',
	    get: function get$$1() {
	      return this.uniforms.edgeThresholdMin.value;
	    },
	    set: function set$$1(value) {
	      this.uniforms.edgeThresholdMin.value = value;
	    }
	  }]);
	  return FXAAPass;
	}(ShaderPass);

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

					defines: Object.assign({}, shader.defines),
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

	// The MIT License

	var EffectComposer = function (_Three$EffectComposer) {
	  inherits(EffectComposer, _Three$EffectComposer);

	  function EffectComposer() {
	    classCallCheck(this, EffectComposer);
	    return possibleConstructorReturn(this, (EffectComposer.__proto__ || Object.getPrototypeOf(EffectComposer)).apply(this, arguments));
	  }

	  createClass(EffectComposer, [{
	    key: 'dispose',
	    value: function dispose() {
	      this.renderTarget1.dispose();
	      this.renderTarget2.dispose();
	      for (var i = 0; i < this.passes.length; ++i) {
	        var pass = this.passes[i];
	        if (pass.dispose) {
	          pass.dispose();
	        }
	      }
	    }
	  }, {
	    key: 'addPass',
	    value: function addPass(pass) {
	      this.passes.push(pass);

	      var _renderer$getSize = this.renderer.getSize(),
	          width = _renderer$getSize.width,
	          height = _renderer$getSize.height;

	      var pixelRatio = this.renderer.getPixelRatio();
	      pass.setSize(width, height, pixelRatio);
	    }
	  }, {
	    key: 'insertPass',
	    value: function insertPass(pass, index) {
	      this.passes.splice(index, 0, pass);

	      var _renderer$getSize2 = this.renderer.getSize(),
	          width = _renderer$getSize2.width,
	          height = _renderer$getSize2.height;

	      var pixelRatio = this.renderer.getPixelRatio();
	      pass.setSize(width, height, pixelRatio);
	    }
	  }, {
	    key: 'setSize',
	    value: function setSize(width, height) {
	      var pixelRatio = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;

	      var deviceWidth = width * pixelRatio;
	      var deviceHeight = height * pixelRatio;
	      this.renderTarget1.setSize(deviceWidth, deviceHeight);
	      this.renderTarget2.setSize(deviceWidth, deviceHeight);
	      for (var i = 0; i < this.passes.length; ++i) {
	        this.passes[i].setSize(width, height, pixelRatio);
	      }
	    }
	  }]);
	  return EffectComposer;
	}(Three.EffectComposer);

	var fragmentShader$1 = "#define GLSLIFY 1\n// The MIT License\n// Copyright (C) 2016-Present Shota Matsuda\n\n#ifndef KERNEL_SIZE\n  #define KERNEL_SIZE 9\n#endif\n\nuniform sampler2D tDiffuse;\nuniform vec2 resolution;\nuniform vec2 direction;\nuniform float radius;\nuniform float radiusMax;\nuniform float center;\nuniform float scale;\n\nvarying vec2 vUv;\n\nvoid main() {\n  vec4 color = vec4(0.0);\n  float gradient = pow(abs((center * 0.5 + 0.5) - vUv.y) * 2.0, 2.0);\n  vec2 aspect = vec2(resolution.y / resolution.x, 1.0);\n  vec2 amount = min(radius * gradient * aspect / scale, radiusMax);\n  vec2 offset = amount * direction;\n\n  #if KERNEL_SIZE == 9\n    color += texture2D(tDiffuse, vUv) * 0.162443;\n    color += texture2D(tDiffuse, vUv + offset) * 0.151793;\n    color += texture2D(tDiffuse, vUv - offset) * 0.151793;\n    color += texture2D(tDiffuse, vUv + offset * 2.0) * 0.123853;\n    color += texture2D(tDiffuse, vUv - offset * 2.0) * 0.123853;\n    color += texture2D(tDiffuse, vUv + offset * 3.0) * 0.08824;\n    color += texture2D(tDiffuse, vUv - offset * 3.0) * 0.08824;\n    color += texture2D(tDiffuse, vUv + offset * 4.0) * 0.0548925;\n    color += texture2D(tDiffuse, vUv - offset * 4.0) * 0.0548925;\n  #endif\n\n  #if KERNEL_SIZE == 7\n    color += texture2D(tDiffuse, vUv) * 0.182476;\n    color += texture2D(tDiffuse, vUv + offset) * 0.170513;\n    color += texture2D(tDiffuse, vUv - offset) * 0.170513;\n    color += texture2D(tDiffuse, vUv + offset * 2.0) * 0.139127;\n    color += texture2D(tDiffuse, vUv - offset * 2.0) * 0.139127;\n    color += texture2D(tDiffuse, vUv + offset * 3.0) * 0.099122;\n    color += texture2D(tDiffuse, vUv - offset * 3.0) * 0.099122;\n  #endif\n\n  #if KERNEL_SIZE == 5\n    color += texture2D(tDiffuse, vUv) * 0.227595;\n    color += texture2D(tDiffuse, vUv + offset) * 0.212674;\n    color += texture2D(tDiffuse, vUv - offset) * 0.212674;\n    color += texture2D(tDiffuse, vUv + offset * 2.0) * 0.1735285;\n    color += texture2D(tDiffuse, vUv - offset * 2.0) * 0.1735285;\n  #endif\n\n  gl_FragColor = color;\n}\n";

	var vertexShader$1 = "#define GLSLIFY 1\n// The MIT License\n// Copyright (C) 2016-Present Shota Matsuda\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

	// The MIT License

	var TiltShiftPass = function (_Three$Pass) {
	  inherits(TiltShiftPass, _Three$Pass);

	  function TiltShiftPass() {
	    var width = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 256;
	    var height = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 256;
	    var size = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 9;

	    var _ref = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {},
	        _ref$radius = _ref.radius,
	        radius = _ref$radius === undefined ? 3 : _ref$radius,
	        radiusMax = _ref.radiusMax,
	        _ref$center = _ref.center,
	        _ref$scale = _ref.scale,
	        scale = _ref$scale === undefined ? 1024 : _ref$scale;

	    classCallCheck(this, TiltShiftPass);

	    var _this = possibleConstructorReturn(this, (TiltShiftPass.__proto__ || Object.getPrototypeOf(TiltShiftPass)).call(this));

	    _this.needsSwap = false;
	    _this.uniforms = {
	      tDiffuse: { value: null },
	      resolution: { value: new Three.Vector2(width, height) },
	      direction: { value: new Three.Vector2() },
	      radius: { value: radius },
	      radiusMax: { value: radiusMax !== undefined ? radiusMax : radius * 2 },
	      center: { value: 0 },
	      scale: { value: scale }
	    };
	    _this.material = new Three.ShaderMaterial({
	      defines: {
	        KERNEL_SIZE: size
	      },
	      uniforms: _this.uniforms,
	      vertexShader: vertexShader$1,
	      fragmentShader: fragmentShader$1
	    });
	    _this.camera = new Three.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	    _this.scene = new Three.Scene();
	    var geometry = new Three.PlaneBufferGeometry(2, 2);
	    _this.quad = new Three.Mesh(geometry, _this.material);
	    _this.quad.frustumCulled = false;
	    _this.scene.add(_this.quad);
	    return _this;
	  }

	  createClass(TiltShiftPass, [{
	    key: 'dispose',
	    value: function dispose() {
	      this.material.dispose();
	    }
	  }, {
	    key: 'render',
	    value: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {
	      var scene = this.scene,
	          camera = this.camera,
	          material = this.material;

	      material.uniforms.tDiffuse.value = readBuffer.texture;
	      material.uniforms.direction.value.set(1, 0);
	      renderer.render(scene, camera, writeBuffer, this.clear);
	      material.uniforms.tDiffuse.value = writeBuffer.texture;
	      material.uniforms.direction.value.set(0, 1);
	      if (this.renderToScreen) {
	        renderer.render(scene, camera, undefined, this.clear);
	      } else {
	        renderer.render(scene, camera, readBuffer, this.clear);
	      }
	    }
	  }, {
	    key: 'setSize',
	    value: function setSize(width, height) {

	      this.uniforms.resolution.value.set(width, height);
	    }
	  }, {
	    key: 'radius',
	    get: function get$$1() {
	      return this.uniforms.radius.value;
	    },
	    set: function set$$1(value) {
	      this.uniforms.radius.value = value;
	    }
	  }, {
	    key: 'radiusMax',
	    get: function get$$1() {
	      return this.uniforms.radiusMax.value;
	    },
	    set: function set$$1(value) {
	      this.uniforms.radiusMax.value = value;
	    }
	  }, {
	    key: 'center',
	    get: function get$$1() {
	      return this.uniforms.center.value;
	    },
	    set: function set$$1(value) {
	      this.uniforms.center.value = value;
	    }
	  }, {
	    key: 'scale',
	    get: function get$$1() {
	      return this.uniforms.scale.value;
	    },
	    set: function set$$1(value) {
	      this.uniforms.scale.value = value;
	    }
	  }]);
	  return TiltShiftPass;
	}(Three.Pass);

	var fragmentShader$2 = "#define GLSLIFY 1\n// The MIT License\n// Copyright (C) 2016-Present Shota Matsuda\n\n// The MIT License\n// Copyright (C) 2016-Present Shota Matsuda\n\nfloat blendSoftLight(float base, float blend) {\n  return (blend < 0.5) ?\n      (2.0 * base * blend + base * base * (1.0 - 2.0 * blend))\n    : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend));\n}\n\nvec3 blendSoftLight(vec3 base, vec3 blend) {\n  return vec3(blendSoftLight(base.r, blend.r),\n              blendSoftLight(base.g, blend.g),\n              blendSoftLight(base.b, blend.b));\n}\n\nvec3 blendSoftLight(vec3 base, vec3 blend, float opacity) {\n  return (blendSoftLight(base, blend) * opacity + base * (1.0 - opacity));\n}\n\nuniform sampler2D tDiffuse;\nuniform sampler2D tNoise;\nuniform vec2 resolution;\nuniform float amount;\n\nvarying vec2 vUv;\n\nvoid main() {\n  // Make vivider and darker\n  vec4 pixel = texture2D(tDiffuse, vUv);\n  vec3 color = pixel.rgb;\n  vec2 uv = (vUv - vec2(0.5)) * 2.0 * vec2(\n      clamp(resolution.x / resolution.y, 0.0, 1.0),\n      clamp(resolution.y / resolution.x, 0.0, 1.0));\n  float coeff = amount * dot(uv, uv);\n  color = blendSoftLight(color, vec3(0.0), coeff);\n  color = mix(color, vec3(0.0), vec3(coeff * 0.2));\n\n  // Add noise to reduce banding\n  float noise = texture2D(tNoise, fract(vUv * resolution / vec2(128.0))).r;\n  color += mix(-1.0 / 64.0, 1.0 / 64.0, noise);\n\n  gl_FragColor = vec4(color, pixel.a);\n}\n";

	var noiseImage = 'data:image/png;base64,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';

	var vertexShader$2 = "#define GLSLIFY 1\n// The MIT License\n// Copyright (C) 2016-Present Shota Matsuda\n\nvarying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}\n";

	// The MIT License

	var VignettePass = function (_ShaderPass) {
	  inherits(VignettePass, _ShaderPass);

	  function VignettePass() {
	    var width = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 256;
	    var height = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 256;
	    var pixelRatio = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
	    var amount = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 1;
	    classCallCheck(this, VignettePass);

	    var deviceWidth = width * pixelRatio;
	    var deviceHeight = height * pixelRatio;

	    var _this = possibleConstructorReturn(this, (VignettePass.__proto__ || Object.getPrototypeOf(VignettePass)).call(this, {
	      uniforms: {
	        tDiffuse: { value: null },
	        tNoise: { value: null },
	        resolution: { value: new Three.Vector2(deviceWidth, deviceHeight) },
	        amount: { value: amount }
	      },
	      vertexShader: vertexShader$2,
	      fragmentShader: fragmentShader$2
	    }));

	    _this.uniforms.tNoise.value = new Three.TextureLoader().load(noiseImage);
	    return _this;
	  }

	  createClass(VignettePass, [{
	    key: 'dispose',
	    value: function dispose() {
	      get(VignettePass.prototype.__proto__ || Object.getPrototypeOf(VignettePass.prototype), 'dispose', this).call(this);
	      this.uniforms.tNoise.value.dispose();
	    }
	  }, {
	    key: 'setSize',
	    value: function setSize(width, height) {
	      var pixelRatio = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;

	      var deviceWidth = width * pixelRatio;
	      var deviceHeight = height * pixelRatio;
	      this.uniforms.resolution.value.set(deviceWidth, deviceHeight);
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
	}(ShaderPass);

	// The MIT License

	var Postprocess = function () {
	  function Postprocess(renderer) {
	    classCallCheck(this, Postprocess);

	    this.renderer = renderer;
	    this.composer = new EffectComposer(this.renderer);
	    this.tiltShiftPass = new TiltShiftPass();
	    this.composer.addPass(this.tiltShiftPass);
	    this.vignettePass = new VignettePass();
	    this.composer.addPass(this.vignettePass);
	    this.ensureRenderToScreen();
	  }

	  createClass(Postprocess, [{
	    key: 'render',
	    value: function render(scene, camera) {
	      this.composer.render();
	    }
	  }, {
	    key: 'setSize',
	    value: function setSize(width, height) {
	      var pixelRatio = this.renderer.getPixelRatio();
	      this.composer.setSize(width, height, pixelRatio);
	    }
	  }, {
	    key: 'addPass',
	    value: function addPass(pass) {
	      this.composer.addPass(pass);
	    }
	  }, {
	    key: 'insertPass',
	    value: function insertPass(pass, index) {
	      this.composer.insertPass(pass, index);
	    }
	  }, {
	    key: 'ensureRenderToScreen',
	    value: function ensureRenderToScreen() {
	      var lastPass = void 0;
	      for (var i = 0; i < this.composer.passes.length; ++i) {
	        var pass = this.composer.passes[i];
	        pass.renderToScreen = false;
	        if (pass.enabled) {
	          lastPass = pass;
	        }
	      }
	      if (lastPass) {
	        lastPass.renderToScreen = true;
	      }
	    }
	  }]);
	  return Postprocess;
	}();

	// The MIT License

	var RenderPass = function (_Three$Pass) {
	  inherits(RenderPass, _Three$Pass);

	  function RenderPass(scene, camera, overrideMaterial, clearColor, clearAlpha) {
	    classCallCheck(this, RenderPass);

	    var _this = possibleConstructorReturn(this, (RenderPass.__proto__ || Object.getPrototypeOf(RenderPass)).call(this));

	    _this.scene = scene;
	    _this.camera = camera;
	    _this.overrideMaterial = overrideMaterial;
	    _this.clearColor = clearColor;
	    _this.clearAlpha = clearAlpha !== undefined ? clearAlpha : 0;
	    _this.clear = true;
	    _this.clearDepth = false;
	    _this.needsSwap = false;
	    _this.info = {
	      render: {},
	      memory: {},
	      programs: []
	    };
	    return _this;
	  }

	  createClass(RenderPass, [{
	    key: 'render',
	    value: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {
	      // Save renderer's states
	      var autoClear = renderer.autoClear;

	      renderer.autoClear = false;
	      var clearColor = void 0;
	      var clearAlpha = void 0;
	      if (this.clearColor) {
	        clearColor = renderer.getClearColor().getHex();
	        clearAlpha = renderer.getClearAlpha();
	        renderer.setClearColor(this.clearColor, this.clearAlpha);
	      }
	      if (this.clearDepth) {
	        renderer.clearDepth();
	      }

	      // Render using our override material if any
	      this.scene.overrideMaterial = this.overrideMaterial;
	      this.onBeforeRender(renderer, this.scene, this.camera);
	      if (this.renderToScreen) {
	        renderer.render(this.scene, this.camera, undefined, this.clear);
	      } else {
	        renderer.render(this.scene, this.camera, readBuffer, this.clear);
	      }
	      this.info = {
	        render: _extends({}, renderer.info.render),
	        memory: _extends({}, renderer.info.memory),
	        programs: [].concat(toConsumableArray(renderer.info.programs))
	      };
	      this.onAfterRender(renderer, this.scene, this.camera);
	      this.scene.overrideMaterial = null;

	      // Restore renderer's states
	      renderer.autoClear = autoClear;
	      if (this.clearColor) {
	        renderer.setClearColor(clearColor, clearAlpha);
	      }
	    }
	  }, {
	    key: 'onBeforeRender',
	    value: function onBeforeRender(renderer, scene, camera) {}
	  }, {
	    key: 'onAfterRender',
	    value: function onAfterRender(renderer, scene, camera) {}
	  }]);
	  return RenderPass;
	}(Three.Pass);

	// The MIT License

	var ScissorPass = function (_Three$Pass) {
	  inherits(ScissorPass, _Three$Pass);

	  function ScissorPass(scissor) {
	    classCallCheck(this, ScissorPass);

	    var _this = possibleConstructorReturn(this, (ScissorPass.__proto__ || Object.getPrototypeOf(ScissorPass)).call(this));

	    _this.scissor = scissor;
	    _this.needsSwap = false;
	    return _this;
	  }

	  createClass(ScissorPass, [{
	    key: 'render',
	    value: function render(renderer, writeBuffer, readBuffer, delta, maskActive) {
	      var scissor = this.scissor;

	      if (scissor) {
	        var x = scissor.x,
	            y = scissor.y,
	            z = scissor.z,
	            w = scissor.w;

	        if (scissor.width !== undefined && scissor.height !== undefined) {
	          var _renderer$getSize = renderer.getSize(),
	              height = _renderer$getSize.height;

	          y = height - y - scissor.height;
	          z = scissor.width;
	          w = scissor.height;
	        }
	        var pixelRatio = renderer.getPixelRatio();
	        x *= pixelRatio;
	        y *= pixelRatio;
	        z *= pixelRatio;
	        w *= pixelRatio;
	        readBuffer.scissorTest = true;
	        readBuffer.scissor.set(x, y, z, w);
	        writeBuffer.scissorTest = true;
	        writeBuffer.scissor.set(x, y, z, w);
	      }
	    }
	  }]);
	  return ScissorPass;
	}(Three.Pass);

	// The MIT License

	var main = {
	  BloomPass: BloomPass,
	  ClearScissorPass: ClearScissorPass,
	  FXAAPass: FXAAPass,
	  Postprocess: Postprocess,
	  RenderPass: RenderPass,
	  ScissorPass: ScissorPass,
	  TiltShiftPass: TiltShiftPass,
	  VignettePass: VignettePass
	};

	exports.BloomPass = BloomPass;
	exports.ClearScissorPass = ClearScissorPass;
	exports.FXAAPass = FXAAPass;
	exports.Postprocess = Postprocess;
	exports.RenderPass = RenderPass;
	exports.ScissorPass = ScissorPass;
	exports.TiltShiftPass = TiltShiftPass;
	exports.VignettePass = VignettePass;
	exports.default = main;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=planck-postprocess.js.map
