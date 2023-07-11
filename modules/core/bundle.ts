import * as core from './src'

// @ts-ignore
globalThis.msagl = globalThis.msagl || {}

Object.assign(globalThis.msagl, core)
