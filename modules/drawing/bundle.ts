import * as drawing from './src'

// @ts-ignore
globalThis.msagl = globalThis.msagl || {}

Object.assign(globalThis.msagl, drawing)
