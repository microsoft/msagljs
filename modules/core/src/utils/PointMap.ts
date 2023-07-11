import {Point} from '../math/geometry/point'

export class PointMap<T> {
  m: Map<string, T>
  deleteP(point: Point): boolean {
    return this.delete(point.x, point.y)
  }
  clear() {
    this.m.clear()
  }

  get size(): number {
    return this.m.size
  }
  setxy(x: number, y: number, v: T) {
    this.m.set(getKey(x, y), v)
  }
  set(p: Point, v: T) {
    this.setxy(p.x, p.y, v)
  }

  delete(x: number, y: number): boolean {
    return this.m.delete(getKey(x, y))
  }

  hasxy(x: number, y: number): boolean {
    return this.m.has(getKey(x, y))
  }
  has(p: Point) {
    return this.hasxy(p.x, p.y)
  }
  getxy(x: number, y: number) {
    return this.m.get(getKey(x, y))
  }
  get(p: Point) {
    return this.getxy(p.x, p.y)
  }
  constructor() {
    this.m = new Map<string, T>()
  }

  *keys(): IterableIterator<Point> {
    for (const p of this.m.keys()) {
      const parts = p.split(',')
      yield new Point(Number(parts[0]), Number(parts[1]))
    }
  }

  *[Symbol.iterator](): IterableIterator<[Point, T]> {
    for (const [p, v] of this.m) {
      const parts = p.split(',')
      yield [new Point(Number(parts[0]), Number(parts[1])), v]
    }
  }

  *values(): IterableIterator<T> {
    yield* this.m.values()
  }
}
function getKey(x: number, y: number): string {
  return x.toString() + ',' + y.toString()
}
