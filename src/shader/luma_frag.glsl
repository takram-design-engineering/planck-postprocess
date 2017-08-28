// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

uniform sampler2D tDiffuse;

varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  gl_FragColor.rgb = color.rgb;
  gl_FragColor.a = dot(color.rgb, vec3(0.299, 0.587, 0.114));
}
