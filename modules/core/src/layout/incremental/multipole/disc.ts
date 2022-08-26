import {Point} from '../../../math/geometry'
import {Assert} from '../../../utils/assert'

export class Disc {
  //  disc centre

  private c: Point

  /**   disc centre*/
  get Center(): Point {
    return this.c
  }

  //  radius

  private r: number

  /**   Radius of disc */
  get Radius(): number {
    return this.r
  }

  private r2: number

  //  squared distance from the centre of this disc to point

  //  <returns></returns>
  Distance2(point: Point): number {
    const dy: number = this.c.y - point.y
    const dx: number = this.c.x - point.x
    return dx * dx + dy * dy
  }

  //  Test if point is contained in this disc

  //  <returns></returns>
  Contains(point: Point): boolean {
    return this.Distance2(point) - 1e-7 <= this.r2
  }

  //  test if all specified points (apart from the except list) are contained in this disc

  //  <returns>true if all points are contained in the disc</returns>
  ContainsPN(points: Point[], except: number[]): boolean {
    for (let i = 0; i < points.length; i++) {
      if (except.findIndex((j) => j == i) == -1 && !this.Contains(points[i])) {
        return false
      }
    }

    return true
  }

  //  create a zero radius disc centred at center

  static constructorP(center: Point) {
    const r = new Disc()
    r.c = center
    r.r = 0
    r.r2 = 0
    return r
  }

  //  find the point mid-way between two points

  static midPoint(startPoint: Point, endPoint: Point): Point {
    return new Point((endPoint.x + startPoint.x) / 2, (endPoint.y + startPoint.y) / 2)
  }

  //  Create the smallest possible disc with the specified points on the boundary

  static constructorPP(firstBoundaryPoint: Point, secondBoundaryPoint: Point): Disc {
    const d = new Disc()
    d.c = Disc.midPoint(firstBoundaryPoint, secondBoundaryPoint)
    d.r2 = d.Distance2(firstBoundaryPoint)
    d.r = Math.sqrt(d.r2)
    Assert.assert(d.OnBoundary(firstBoundaryPoint))
    Assert.assert(d.OnBoundary(secondBoundaryPoint))
    return d
  }

  //  test if a point lies on (within a small delta of) the boundary of this disc

  //  <returns></returns>
  OnBoundary(point: Point): boolean {
    const d: number = this.Distance2(point)
    return Math.abs(d - this.r2) / (d + this.r2) < 1e-5
  }

  //  computes the centre of the disc with the 3 specified points on the boundary

  //  <returns></returns>
  static centre(p1: Point, p2: Point, p3: Point): Point {
    Assert.assert(p2.x != p1.x)
    Assert.assert(p3.x != p2.x)
    const ma = (p2.y - p1.y) / (p2.x - p1.x)
    const mb = (p3.y - p2.y) / (p3.x - p2.x)
    Assert.assert(mb != ma)
    //  collinear points not allowed
    let y: number
    const x = (ma * mb * (p1.y - p3.y) + mb * (p1.x + p2.x) - ma * (p2.x + p3.x)) / (2 * (mb - ma))
    if (Math.abs(ma) > Math.abs(mb)) {
      y = (p1.y + p2.y) / 2 - (x - (p1.x + p2.x) / 2) / ma
    } else {
      y = (p2.y + p3.y) / 2 - (x - (p2.x + p3.x) / 2) / mb
    }

    return new Point(x, y)
  }

  //  if the area of the triangle formed by the 3 points is 0 then the points are collinear

  //  <returns></returns>
  static Collinear(p1: Point, p2: Point, p3: Point): boolean {
    return p1.x * (p2.y - p3.y) + (p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) == 0
  }

  static count = 0

  //  Create a disc with the specified points on the boundary

  static constructorPPP(p1: Point, p2: Point, p3: Point) {
    Disc.count++
    const d = new Disc()
    if (Disc.Collinear(p1, p2, p3)) {
      const LL: Point = new Point(Math.min(p1.x, Math.min(p2.x, p3.x)), Math.min(p1.y, Math.max(p2.y, p3.y)))
      const UR: Point = new Point(Math.max(p1.x, Math.max(p2.x, p3.x)), Math.max(p1.y, Math.max(p2.y, p3.y)))
      d.c = Disc.midPoint(LL, UR)
      d.r2 = d.Distance2(UR)
      d.r = Math.sqrt(d.r2)
    } else {
      const dx12: number = p2.x - p1.x
      const dx23: number = p3.x - p2.x
      const dx13: number = p3.x - p1.x

      if (dx12 != 0) {
        if (dx23 != 0) {
          d.c = Disc.centre(p1, p2, p3)
        } else {
          Assert.assert(dx13 != 0)
          d.c = Disc.centre(p2, p1, p3)
        }
      } else {
        Assert.assert(dx23 != 0)
        //  because points are not collinear
        d.c = Disc.centre(p2, p3, p1)
      }

      d.r2 = d.Distance2(p1)
      d.r = Math.sqrt(d.r2)
      Assert.assert(d.OnBoundary(p1))
      Assert.assert(d.OnBoundary(p2))
      Assert.assert(d.OnBoundary(p3))
    }
    return d
  }
}
