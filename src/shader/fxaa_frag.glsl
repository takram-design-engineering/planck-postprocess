// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

#define FXAA_GLSL_100 1
#define FXAA_GREEN_AS_LUMA 1

#pragma glslify: FxaaPixelShader = require(./fxaa.glsl)

uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float subpix;
uniform float edgeThreshold;
uniform float edgeThresholdMin;

varying vec2 vUv;

void main() {
  gl_FragColor = FxaaPixelShader(
      vUv,
      tDiffuse,
      resolution,
      subpix,
      edgeThreshold,
      edgeThresholdMin);
}
