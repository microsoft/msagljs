import {IntPair} from './IntPair'

export class IntPairMap<T> {
  isEmpty(): boolean {
    if (this.arrayOfMaps.length === 0) return true
    for (const t of this.arrayOfMaps) {
      if (t.size > 0) {
        return false
      }
    }
    return true
  }
  private arrayOfMaps: Map<number, T>[]
  set(x: number, y: number, v: T) {
    let m = this.arrayOfMaps[x]
    if (m === undefined) this.arrayOfMaps[x] = m = new Map<number, T>()
    m.set(y, v)
  }
  setPair(p: IntPair, v: T) {
    this.set(p.x, p.y, v)
  }

  delete(x: number, y: number) {
    if (x < 0 || x >= this.arrayOfMaps.length) {
      return
    }
    const m = this.arrayOfMaps[x]
    if (m === undefined) return
    m.delete(y)
    if (m.size === 0) this.arrayOfMaps[x] = undefined
  }
  has(x: number, y: number): boolean {
    if (x < 0 || x >= this.arrayOfMaps.length) {
      return false
    }
    const m = this.arrayOfMaps[x]
    if (m === undefined) return false
    return m.has(y)
  }
  get(x: number, y: number) {
    if (x < 0 || x >= this.arrayOfMaps.length) {
      return null
    }
    const m = this.arrayOfMaps[x]
    if (m === undefined) return null
    return m.get(y)
  }

  getI(p: IntPair) {
    return this.get(p.x, p.y)
  }
  /** n is the maximum of (x + 1) where (x, *) runs over the keys  */
  constructor() {
    this.arrayOfMaps = new Array<Map<number, T>>()
  }

  *keys(): IterableIterator<IntPair> {
    for (let i = 0; i < this.arrayOfMaps.length; i++) {
      const map = this.arrayOfMaps[i]
      if (map === undefined) continue
      for (const p of map) {
        yield new IntPair(i, p[0])
      }
    }
  }

  *keyValues(): IterableIterator<[IntPair, T]> {
    for (let i = 0; i < this.arrayOfMaps.length; i++) {
      const map = this.arrayOfMaps[i]
      if (map === undefined) continue
      for (const p of map) {
        yield [new IntPair(i, p[0]), p[1]]
      }
    }
  }
  *values(): IterableIterator<T> {
    for (let i = 0; i < this.arrayOfMaps.length; i++) {
      const map = this.arrayOfMaps[i]
      if (map === undefined) continue
      for (const p of map) {
        yield p[1]
      }
    }
  }
  get size() {
    let r = 0
    for (let i = 0; i < this.arrayOfMaps.length; i++) {
      const map = this.arrayOfMaps[i]
      if (map === undefined) continue
      r += map.size
    }
    return r
  }
}
