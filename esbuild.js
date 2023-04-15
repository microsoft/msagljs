const esbuild = require('esbuild')
const {externalGlobalPlugin} = require('esbuild-plugin-external-global')

const INPUT = process.argv[2]
const OUTPUT = process.argv[3]

esbuild.build({
  entryPoints: [INPUT],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: OUTPUT,
  plugins: [
    externalGlobalPlugin({
      '@msagl/core': 'globalThis.msagl',
      '@msagl/core/drawing': 'globalThis.msagl',
    }),
  ],
})
