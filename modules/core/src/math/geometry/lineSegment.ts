import {ICurve} from './icurve'
import {Point, PointJSON, TriangleOrientation} from './point'
import {Parallelogram} from './parallelogram'
import {PlaneTransformation} from './planeTransformation'
import {Rectangle} from './rectangle'
import {GeomConstants} from './geomConstants'
import {PN} from './parallelogramNode'
export type LineSegmentJSON = {start: PointJSON; end: PointJSON}

export class LineSegment implements ICurve {
  static fromJSON(lineData: LineSegmentJSON): LineSegment {
    return LineSegment.mkPP(Point.fromJSON(lineData.start), Point.fromJSON(lineData.end))
  }

  toJSON(): LineSegmentJSON {
    return {start: this.start.toJSON(), end: this.end.toJSON()}
  }

  start: Point //the line goes from start to end
  end: Point // the line end point
  readonly parStart = 0
  readonly parEnd = 1

  // Offsets the curve in the direction of dir
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  offsetCurve(offset: number, dir: Point): ICurve {
    return null
  }

  constructor(x: number, y: number, x1: number, y1: number) {
    this.start = new Point(x, y)
    this.end = new Point(x1, y1)
  }

  // Returns the trim curve
  trim(start: number, end: number): ICurve {
    start = Math.max(this.parStart, start)
    end = Math.min(this.parEnd, end)
    if (start > end) throw 'wrong params in trimming'

    const p1 = this.value(start)
    const p2 = this.value(end)
    if (Point.close(p1, p2, GeomConstants.distanceEpsilon)) {
      return null
    }
    return LineSegment.mkPP(p1, p2)
  }

  value(t: number): Point {
    return this.start.add(this.end.sub(this.start).mul(t))
  }
  // Not Implemented: Returns the trimmed curve, wrapping around the end if start is greater than end.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  trimWithWrap(start: number, end: number): ICurve {
    return null
  } // not implemented

  // A tree of ParallelogramNodes covering the curve.
  // This tree is used in curve intersections routines.
  // <value></value>
  pNodeOverICurve(): PN {
    const side = this.end.sub(this.start).mul(0.5)
    return {
      parallelogram: Parallelogram.parallelogramByCornerSideSide(this.start, side, side),
      seg: this,
      leafBoxesOffset: 0,
      node: {
        low: 0,
        high: 1,
        chord: this,
      },
    }
  }

  normal(): Point {
    let t = this.start.sub(this.end)
    t = t.div(t.length)
    return new Point(-t.y, t.x)
  }

  // construct a line segment
  static mkPP(start: Point, end: Point): LineSegment {
    return new LineSegment(start.x, start.y, end.x, end.y)
  }

  // constructs a line segment
  static mkLinePXY(p: Point, x: number, y: number) {
    return new LineSegment(p.x, p.y, x, y)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  derivative(t: number) {
    return this.end.sub(this.start)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  secondDerivative(t: number) {
    return new Point(0, 0)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  thirdDerivative(t: number) {
    return new Point(0, 0)
  }

  reverse() {
    return LineSegment.mkPP(this.end, this.start)
  }

  /*      
static internal IntersectionInfo Cross(LineSeg coeff, LineSeg side1){
IntersectionInfo xx=CrossTwoLines(coeff.start, coeff.End-coeff.start,side1.start, side1.End-side1.start);
if (xx == null )
{
//parallel segs
Point adir=coeff.d1(0);
Point bdir=side1.d1(0);

if (adir.length > bdir.length)
{
if (adir.length > Curve.DistEps)
{
adir = adir.normalize();
if(Math.Abs((coeff-side1)*adir<Curve.DistEps)){

}
}
}
return null;
}

if(xx.Par0>1){
if (Point.closeDistEps(coeff.End, xx.x))
{
xx.x = coeff.End;
xx.Par0 = 1;
}
else
return null;
}
else if(xx.Par0<0){
if(Point.closeDistEps(coeff.start,xx.x)){
xx.x=coeff.start; 
xx.Par0=1;
}
else
return null;
}

if (xx.Par1 > 1)
{
if (Point.closeDistEps(side1.End, xx.x))
{
xx.x = coeff.End;
xx.Par1 = 1;
}
else
return null;
}
else if (xx.Par1 < 0)
{
if (Point.closeDistEps(side1.start, xx.x))
{
xx.x = coeff.start;
xx.Par1 = 1;
}
else
return null;
}

return xx;
}
* */

  // mutable! changes this
  // Returns the curved moved by delta
  translate(delta: Point) {
    this.start = this.start.add(delta)
    this.end = this.end.add(delta)
  }

  // Scale (multiply) from origin by x and y
  scaleFromOrigin(xScale: number, yScale: number) {
    return LineSegment.mkPP(this.start.scale(xScale, yScale), this.end.scale(xScale, yScale))
  }

  // gets the parameter at a specific length from the start along the curve
  getParameterAtLength(length: number): number {
    const len = this.end.sub(this.start).length
    if (len < GeomConstants.tolerance) return 0
    const t = length / len
    return t > 1 ? 1 : t < 0 ? 0 : t
  }

  // Return the transformed curve
  transform(transformation: PlaneTransformation): ICurve {
    return LineSegment.mkPP(transformation.multiplyPoint(this.start), transformation.multiplyPoint(this.end))
  }

  // returns a parameter t such that the distance between curve[t] and targetPoint is minimal
  // and t belongs to the closed segment [low,high]
  closestParameterWithinBounds(targetPoint: Point, low: number, high: number) {
    let t = this.closestParameter(targetPoint)
    if (t < low) t = low
    if (t > high) t = high
    return t
  }

  // return length of the curve segment [start,end]
  lengthPartial(start: number, end: number) {
    return this.value(end).sub(this.value(start)).length
  }

  // Get the length of the curve
  get length() {
    return this.start.sub(this.end).length
  }
  // The bounding box of the line
  get boundingBox() {
    return Rectangle.mkPP(this.start, this.end)
  }

  // clones the curve.

  clone() {
    return LineSegment.mkPP(this.start.clone(), this.end.clone())
  }

  static closestParameterOnLineSegment(point: Point, segmentStart: Point, segmentEnd: Point): number {
    const bc = segmentEnd.sub(segmentStart)
    const ba = point.sub(segmentStart)
    const c1 = bc.dot(ba)
    if (c1 <= 0.0 + GeomConstants.tolerance) return 0

    const c2 = bc.dot(bc)
    if (c2 <= c1 + GeomConstants.tolerance) return 1

    return c1 / c2
  }

  // returns a parameter t such that the distance between curve[t] and a is minimal
  closestParameter(targetPoint: Point) {
    return LineSegment.closestParameterOnLineSegment(targetPoint, this.start, this.end)
  }
  // left derivative at t
  leftDerivative(t: number) {
    return this.derivative(t)
  }

  // right derivative at t
  rightDerivative(t: number) {
    return this.derivative(t)
  }
  // returns true if segments are not parallel and are intesecting
  static IntersectPPPP(a: Point, b: Point, c: Point, d: Point): Point | undefined {
    const r = Point.lineLineIntersection(a, b, c, d)
    if (r == null) return
    if (pointIsOnSegment(r, a, b) && pointIsOnSegment(r, c, d)) {
      return r
    } else {
      return undefined
    }
  }

  //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  curvature(t: number) {
    return 0
  }
  //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  curvatureDerivative(t: number) {
    return 0
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  curvatureSecondDerivative(_: number) {
    return 0
  }

  // [a,b] and [c,d] are the segments. u and v are the corresponding closest point params
  // see http://www.geometrictools.com/Documentation/DistanceLine3Line3.pdf
  static minDistBetweenLineSegments(a: Point, b: Point, c: Point, d: Point): {dist: number; parab: number; parcd: number} {
    const u = b.sub(a)
    const v = d.sub(c)
    const w = a.sub(c)

    const D = Point.crossProduct(u, v)

    const uu = u.dot(u) // always >= 0
    const uv = u.dot(v)
    const vv = v.dot(v) // always >= 0
    const uw = u.dot(w)
    const vw = v.dot(w)
    let sN: number, tN: number
    const absD = Math.abs(D)
    let sD = absD,
      tD = absD

    // compute the line parameters of the two closest points
    if (absD < GeomConstants.tolerance) {
      // the lines are almost parallel
      sN = 0.0 // force using point a on segment [a..b]
      sD = 1.0 // to prevent possible division by 0.0 later
      tN = vw
      tD = vv
    } else {
      // get the closest points on the infinite lines
      sN = Point.crossProduct(v, w)
      tN = Point.crossProduct(u, w)
      if (D < 0) {
        sN = -sN
        tN = -tN
      }

      if (sN < 0.0) {
        // parab < 0 => the s=0 edge is visible
        sN = 0.0
        tN = vw
        tD = vv
      } else if (sN > sD) {
        // parab > 1 => the s=1 edge is visible
        sN = sD = 1
        tN = vw + uv
        tD = vv
      }
    }

    if (tN < 0.0) {
      // tc < 0 => the t=0 edge is visible
      tN = 0.0
      // recompute parab for this edge
      if (-uw < 0.0) sN = 0.0
      else if (-uw > uu) sN = sD
      else {
        sN = -uw
        sD = uu
      }
    } else if (tN > tD) {
      // tc > 1 => the t=1 edge is visible
      tN = tD = 1
      // recompute parab for this edge
      if (-uw + uv < 0.0) sN = 0
      else if (-uw + uv > uu) sN = sD
      else {
        sN = -uw + uv
        sD = uu
      }
    }

    const parab_ = Math.abs(sN) < GeomConstants.tolerance ? 0.0 : sN / sD
    const parcd_ = Math.abs(tN) < GeomConstants.tolerance ? 0.0 : tN / tD
    // finally do the division to get parameters
    return {
      parab: parab_,
      parcd: parcd_,
      // get the difference of the two closest points
      //           const dP = w + (parab * u) - (parcd * v),

      dist: w.add(u.mul(parab_).sub(v.mul(parcd_))).length, // return the closest distance
    }
  }
}
/** a - is the point to test
 * [c,b] - is the segment
 * The function actually checks that a is inside of the bounding box of [c,b].
 * ! Use it only when a,b,c are collinear !
 */
export function pointIsOnSegment(a: Point, b: Point, c: Point): boolean {
  return (
    a.x >= Math.min(b.x, c.x) - GeomConstants.distanceEpsilon &&
    a.y >= Math.min(b.y, c.y) - GeomConstants.distanceEpsilon &&
    a.x <= Math.max(b.x, c.x) + GeomConstants.distanceEpsilon &&
    a.y <= Math.max(b.y, c.y) + GeomConstants.distanceEpsilon
  )
}
/** returns true if segments intersect */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abc = Point.getTriangleOrientation(a, b, c)
  const abd = Point.getTriangleOrientation(a, b, d)
  const cda = Point.getTriangleOrientation(c, d, a)
  const cdb = Point.getTriangleOrientation(c, d, b)

  // if abc != abd then ab separates c and d
  // if cda != cdb then cd separates b and a
  if (abc != abd && cda != cdb) return true

  // If the orientations are collinear and the points lie on the segments,
  // the segments intersect
  if (abc == TriangleOrientation.Collinear && pointIsOnSegment(c, a, b)) return true
  if (abd == TriangleOrientation.Collinear && pointIsOnSegment(d, a, b)) return true
  if (cda == TriangleOrientation.Collinear && pointIsOnSegment(a, c, d)) return true
  if (cdb == TriangleOrientation.Collinear && pointIsOnSegment(b, c, d)) return true

  // Otherwise, the segments do not intersect
  return false
}
