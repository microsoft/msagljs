import * as renderer from './src'

// @ts-ignore
globalThis.msagl = globalThis.msagl || {}

Object.assign(globalThis.msagl, renderer)
