// The MIT License
// Copyright (C) 2016-Present Shota Matsuda

import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import nodeResolve from 'rollup-plugin-node-resolve'
import path from 'path'

import config from './rollup.config'
import pkg from './package.json'

export default {
  input: './test/unit.js',
  plugins: [
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
    path.resolve(pkg.browser),
    'chai',
    'mocha',
    'source-map-support/register',
    '@takram/planck-core',
    'three'
  ],
  output: {
    intro: 'var BUNDLER = "rollup";',
    globals: {
      [path.resolve(pkg.browser)]: config.output.name,
      'chai': 'chai',
      'mocha': 'mocha',
      '@takram/planck-core': 'Planck',
      'three': 'THREE'
    },
    format: 'iife',
    file: './dist/test/unit/rollup.js',
    sourcemap: true
  }
}
