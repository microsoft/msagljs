import {GeomGraph, GeomNode} from 'msagl-js'

export function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true
  }
  if (!a || !b) {
    return false
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false
      }
    }
    return true
  } else if (Array.isArray(b)) {
    return false
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) {
      return false
    }
    for (const key of aKeys) {
      if (!b.hasOwnProperty(key)) {
        return false
      }
      if (!deepEqual(a[key], b[key])) {
        return false
      }
    }
    return true
  }
  return false
}

export function getLabelPosition(n: GeomNode): [number, number] {
  if (n instanceof GeomGraph) {
    const box = n.boundingBox
    return [box.center.x, box.bottom + (<GeomGraph>n).labelSize.height / 2 + 2]
  }
  return [n.center.x, n.center.y]
}
