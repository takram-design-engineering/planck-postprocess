// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

uniform sampler2D tDiffuse1;
uniform sampler2D tDiffuse2;
uniform float center;

varying vec2 vUv;

void main() {
  vec4 texel1 = texture2D(tDiffuse1, vUv);
  vec4 texel2 = texture2D(tDiffuse2, vUv);
  gl_FragColor = vec4(texel2.a) * texel2 + vec4(1.0 - texel2.a) * texel1;
}
