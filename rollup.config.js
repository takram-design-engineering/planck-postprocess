// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import glslify from '@shotamatsuda/rollup-plugin-glslify'
import image from '@shotamatsuda/rollup-plugin-image'
import nodeResolve from 'rollup-plugin-node-resolve'
import threeExample from '@shotamatsuda/rollup-plugin-three-example'

import pkg from './package.json'

export default {
  input: pkg.module,
  plugins: [
    image(),
    glslify(),
    threeExample(),
    nodeResolve({ browser: true }),
    commonjs(),
    babel({
      presets: [
        ['es2015', { modules: false }],
        'es2016',
        'es2017',
        'stage-3',
        'stage-2'
      ],
      plugins: [
        'external-helpers'
      ],
      babelrc: false
    })
  ],
  external: [
    'three'
  ],
  output: {
    globals: {
      'three': 'THREE'
    },
    format: 'umd',
    exports: 'named',
    extend: true,
    name: 'Planck',
    file: pkg.main,
    sourcemap: true
  }
}
