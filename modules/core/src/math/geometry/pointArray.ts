import {Point} from './point'

/** A contiguous Float64Array-backed collection of 2D points.
 *  Provides cache-friendly storage and reduced GC pressure compared to Point[] arrays.
 *  Points can be grabbed into mutable Point objects for processing. */
export class PointArray {
  private data: Float64Array
  private length_: number

  constructor(capacity = 16) {
    this.data = new Float64Array(capacity * 2)
    this.length_ = 0
  }

  get length(): number {
    return this.length_
  }

  /** Direct coordinate access without creating Point objects */
  getX(index: number): number {
    return this.data[index * 2]
  }

  getY(index: number): number {
    return this.data[index * 2 + 1]
  }

  setX(index: number, v: number) {
    this.data[index * 2] = v
  }

  setY(index: number, v: number) {
    this.data[index * 2 + 1] = v
  }

  /** Grab a point from the array into a Point object.
   *  If 'out' is provided, it is reused (zero allocation). */
  getPoint(index: number, out?: Point): Point {
    const offset = index * 2
    if (out) {
      out.x = this.data[offset]
      out.y = this.data[offset + 1]
      return out
    }
    return new Point(this.data[offset], this.data[offset + 1])
  }

  /** Write a Point's coordinates into the array at the given index */
  setPoint(index: number, p: Point) {
    const offset = index * 2
    this.data[offset] = p.x
    this.data[offset + 1] = p.y
  }

  /** Set coordinates at the given index */
  setXY(index: number, x: number, y: number) {
    const offset = index * 2
    this.data[offset] = x
    this.data[offset + 1] = y
  }

  /** Append a point, return its index */
  push(x: number, y: number): number {
    const idx = this.length_
    if (idx * 2 + 1 >= this.data.length) {
      this.grow()
    }
    this.data[idx * 2] = x
    this.data[idx * 2 + 1] = y
    this.length_++
    return idx
  }

  /** Append a Point object, return its index */
  pushPoint(p: Point): number {
    return this.push(p.x, p.y)
  }

  /** Remove the last point and return it (or fill into 'out') */
  pop(out?: Point): Point | undefined {
    if (this.length_ === 0) return undefined
    this.length_--
    return this.getPoint(this.length_, out)
  }

  /** Create from an existing Point array */
  static fromPoints(points: Point[]): PointArray {
    const pa = new PointArray(points.length)
    for (const p of points) {
      pa.push(p.x, p.y)
    }
    return pa
  }

  /** Create from a flat coordinate array [x0,y0,x1,y1,...] */
  static fromFlatArray(coords: number[] | Float64Array): PointArray {
    const n = coords.length >> 1
    const pa = new PointArray(n)
    if (coords instanceof Float64Array) {
      pa.data.set(coords)
    } else {
      for (let i = 0; i < coords.length; i++) {
        pa.data[i] = coords[i]
      }
    }
    pa.length_ = n
    return pa
  }

  /** Export to a Point array (allocates new Point objects) */
  toPoints(): Point[] {
    const result = new Array<Point>(this.length_)
    for (let i = 0; i < this.length_; i++) {
      result[i] = new Point(this.data[i * 2], this.data[i * 2 + 1])
    }
    return result
  }

  /** Get a view of the underlying Float64Array (no copy) */
  toFloat64Array(): Float64Array {
    return this.data.subarray(0, this.length_ * 2)
  }

  /** Reset length to 0 without releasing the buffer */
  clear() {
    this.length_ = 0
  }

  /** Iterate over indices */
  *[Symbol.iterator](): IterableIterator<number> {
    for (let i = 0; i < this.length_; i++) {
      yield i
    }
  }

  private grow() {
    const newCap = Math.max(this.data.length * 2, 8)
    const newData = new Float64Array(newCap)
    newData.set(this.data)
    this.data = newData
  }
}
