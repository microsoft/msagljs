import * as core from './src'
import * as drawing from './src/drawing'

// @ts-ignore
globalThis.msagl = globalThis.msagl || {}

Object.assign(globalThis.msagl, core, drawing)
