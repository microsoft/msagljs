import {Point} from '../math/geometry/point'
// suggest class that uses Map<string, T> instead of Map<Point, T>
// and has methods like setxy, getxy, hasxy, deleteP, keys, values, entries
// and has size property
// and has clear method
// and has iterator
// and has constructor
// and has delete method
// and has has method
// and has get method
// and has set method
// and has size property
// and has keys method
// and has values method
// and has entries method
// export class PairMap<T> {
//   // A private property to store the map entries
//   private map: Map<string, T>;

//   // A constructor that initializes the map
//   constructor() {
//     this.map = new Map();
//   }

//   // A method to generate a unique key for each unordered pair of numbers
//   private getKey(a: number, b: number): string {
//     // Sort the numbers and join them with a separator
//     return [a, b].sort().join("_");
//   }

//   // A method to set a value for a given pair of numbers
//   public set(a: number, b: number, value: T): void {
//     // Get the key for the pair
//     const key = this.getKey(a, b);
//     // Set the value in the map
//     this.map.set(key, value);
//   }

//   // A method to get a value for a given pair of numbers
//   public get(a: number, b: number): T | undefined {
//     // Get the key for the pair
//     const key = this.getKey(a, b);
//     // Get the value from the map
//     return this.map.get(key);
//   }

//   // Other methods as needed ...
// }
export class PointMap<T> {
  mapOfMaps: Map<number, Map<number, T>>
  private size_ = 0
  deleteP(point: Point): boolean {
    return this.delete(point.x, point.y)
  }
  clear() {
    this.mapOfMaps.clear()
    this.size_ = 0
  }

  get size(): number {
    return this.size_
  }
  setxy(x: number, y: number, v: T) {
    let m = this.mapOfMaps.get(x)
    if (m == null) this.mapOfMaps.set(x, (m = new Map<number, T>()))

    if (!m.has(y)) {
      this.size_++
    }
    m.set(y, v)
  }
  set(p: Point, v: T) {
    this.setxy(p.x, p.y, v)
  }

  delete(x: number, y: number) {
    const m = this.mapOfMaps.get(x)
    if (m != null) {
      if (m.delete(y)) this.size_--
      return true
    }
    return false
  }

  hasxy(x: number, y: number): boolean {
    const m = this.mapOfMaps.get(x)
    return m != null && m.has(y)
  }
  has(p: Point) {
    return this.hasxy(p.x, p.y)
  }
  getxy(x: number, y: number) {
    const m = this.mapOfMaps.get(x)
    if (m == null) return

    return m.get(y)
  }
  get(p: Point) {
    return this.getxy(p.x, p.y)
  }
  constructor() {
    this.mapOfMaps = new Map<number, Map<number, T>>()
  }

  *keys(): IterableIterator<Point> {
    for (const p of this.mapOfMaps) {
      for (const yp of p[1]) {
        yield new Point(p[0], yp[0])
      }
    }
  }

  *[Symbol.iterator](): IterableIterator<[Point, T]> {
    for (const p of this.mapOfMaps) {
      for (const yV of p[1]) {
        yield [new Point(p[0], yV[0]), yV[1]]
      }
    }
  }

  *values(): IterableIterator<T> {
    for (const p of this.mapOfMaps) {
      for (const yV of p[1]) {
        yield yV[1]
      }
    }
  }
}
