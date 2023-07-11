import {Point} from '..'
import {PointPair} from '../math/geometry/pointPair'

export class PointPairMap<T> {
  m: Map<string, T> = new Map<string, T>()
  clear() {
    this.m.clear()
  }

  get size(): number {
    return this.m.size
  }

  set(pp: PointPair, v: T) {
    this.m.set(getKey(pp), v)
  }

  delete(pp: PointPair) {
    this.m.delete(getKey(pp))
  }

  has(pp: PointPair): boolean {
    return this.m.has(getKey(pp))
  }

  getPP(p: Point, q: Point) {
    return this.get(new PointPair(p, q))
  }
  get(pp: PointPair): T {
    return this.m.get(getKey(pp))
  }

  *keys(): IterableIterator<PointPair> {
    for (const sKey of this.m.keys()) {
      const pp = getPP(sKey)
      yield pp
    }
  }

  *[Symbol.iterator](): IterableIterator<[PointPair, T]> {
    for (const [x, t] of this.m) {
      yield [getPP(x), t]
    }
  }

  *values(): IterableIterator<T> {
    yield* this.m.values()
  }
}
function getPP(sKey: string): PointPair {
  const pointString = sKey.split(' ')
  const firstS = pointString[0]
  const secondS = pointString[1]

  // Remove the parentheses and split by comma
  let parts = firstS.split(',')

  // Convert the parts to numbers
  const first = new Point(Number(parts[0]), Number(parts[1]))
  parts = secondS.split(',')
  const second = new Point(Number(parts[0]), Number(parts[1]))
  const pp = new PointPair(first, second)
  return pp
}

function getKeyPP(first: Point, second: Point): string {
  return [localToString(first), localToString(second)].sort().join(' ')
}

function getKey(pp: PointPair): string {
  return getKeyPP(pp.first, pp.second)
}
function localToString(p: Point):string {  
  return p.x.toString() + ',' + p.y.toString() 
}
