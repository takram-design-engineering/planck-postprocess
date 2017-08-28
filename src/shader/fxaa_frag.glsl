// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

#define FXAA_GLSL_100 1
#define FXAA_QUALITY_PRESET ${quality}

${fxaaShader}

uniform sampler2D tDiffuse;
uniform vec2 resolution;

varying vec2 vUv;

void main() {
  gl_FragColor = FxaaPixelShader(
    vUv,
    tDiffuse,
    resolution,
    ${subpix.toPrecision(10)},
    ${edgeThreshold.toPrecision(10)},
    ${edgeThresholdMin.toPrecision(10)}
  );
  gl_FragColor.a = 1.0;
}
