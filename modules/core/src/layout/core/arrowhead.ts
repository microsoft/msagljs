﻿import {Point} from './../../math/geometry/point'
import {IntersectionInfo} from './../../math/geometry/intersectionInfo'
import {GeomConstants} from './../../math/geometry/geomConstants'
import {Curve} from './../../math/geometry/curve'
import {ICurve} from './../../math/geometry/icurve'
import {Ellipse} from './../../math/geometry/ellipse'
import {LineSegment} from './../../math/geometry/lineSegment'

import {GeomEdge} from './geomEdge'

export class Arrowhead {
  static defaultArrowheadLength = 5
  length = Arrowhead.defaultArrowheadLength
  width = 0
  tipPosition: Point
  toJSON(): string {
    let str = '{'
    if (this.tipPosition) {
      str += '"tipPosition": ' + this.tipPosition.toJSON()
    }
    str += '}'
    return str
  }
  clone(): Arrowhead {
    const r = new Arrowhead()
    r.length = this.length
    r.width = this.width
    r.tipPosition = this.tipPosition
    return r
  }
  constructor() {
    // just for debug
    this.length = Arrowhead.defaultArrowheadLength
  }
  // the edgeGeometry.Curve is trimmed already by the node boundaries</param>
  private static calculateArrowheads(edge: GeomEdge): boolean {
    if (edge.sourceArrowhead == null && edge.targetArrowhead == null) return true
    const parStart = Arrowhead.findTrimStartForArrowheadAtSource(edge)
    if (parStart == null) {
      return false
    }
    const parEnd = Arrowhead.findTrimEndForArrowheadAtTarget(edge)
    if (parEnd == null) {
      return false
    }
    if (
      parStart > parEnd - GeomConstants.intersectionEpsilon ||
      Curve.closeIntersectionPoints(edge.curve.value(parStart), edge.curve.value(parEnd))
    )
      return false //after the trim nothing would be left of the curve
    const c = edge.curve.trim(parStart, parEnd)
    if (c == null) return false
    if (edge.sourceArrowhead != null) edge.sourceArrowhead.tipPosition = edge.curve.start

    if (edge.targetArrowhead != null) edge.targetArrowhead.tipPosition = edge.curve.end
    edge.curve = c
    return true
  }

  static getIntersectionsWithArrowheadCircle(curve: ICurve, arrowheadLength: number, circleCenter: Point): IntersectionInfo[] {
    const e = Ellipse.mkFullEllipseNNP(arrowheadLength, arrowheadLength, circleCenter)
    return Curve.getAllIntersections(e, curve, true)
  }
  // we need to pass arrowhead length here since the original length mibh
  static findTrimEndForArrowheadAtTarget(edgeGeometry: GeomEdge): number {
    const eps = GeomConstants.distanceEpsilon * GeomConstants.distanceEpsilon
    //Assert.assert((edgeGeometry.Curve.End - edgeGeometry.Curve.start).LengthSquared > eps);
    let p = edgeGeometry.curve.parEnd
    if (edgeGeometry.targetArrowhead == null || edgeGeometry.targetArrowhead.length <= GeomConstants.distanceEpsilon) return p
    const curve = edgeGeometry.curve
    let arrowheadLength = edgeGeometry.targetArrowhead.length
    let newCurveEnd: Point
    let intersections: IntersectionInfo[]
    let reps = 10
    do {
      reps--
      if (reps === 0) return
      intersections = Arrowhead.getIntersectionsWithArrowheadCircle(curve, arrowheadLength, curve.end)
      p = intersections.length !== 0 ? Math.max(...intersections.map((x) => x.par1)) : curve.parEnd
      newCurveEnd = edgeGeometry.curve.value(p)
      arrowheadLength /= 2
    } while (newCurveEnd.sub(curve.start).lengthSquared < eps || intersections.length === 0)
    //we would like to have at least something left from the curve
    return p
  }

  static findTrimStartForArrowheadAtSource(edgeGeometry: GeomEdge): number {
    if (edgeGeometry.sourceArrowhead == null || edgeGeometry.sourceArrowhead.length <= GeomConstants.distanceEpsilon)
      return edgeGeometry.curve.parStart
    const eps = GeomConstants.distanceEpsilon * GeomConstants.distanceEpsilon
    /*Assert.assert(
      edgeGeometry.curve.end.sub(edgeGeometry.curve.start).lengthSquared > eps,
    )*/
    let arrowheadLength = edgeGeometry.sourceArrowhead.length
    let newStart: Point
    const curve = edgeGeometry.curve
    let intersections: IntersectionInfo[]
    let reps = 10
    let p: number
    while (--reps > 0) {
      intersections = Arrowhead.getIntersectionsWithArrowheadCircle(curve, arrowheadLength, curve.start)
      if (intersections.length === 0) return curve.parStart
      p = Math.min(...intersections.map((x) => x.par1))
      newStart = intersections.filter((x) => x.par1 === p)[0].x
      // check that something is left from the curve
      if (newStart.sub(curve.end).lengthSquared >= eps) return p
      arrowheadLength /= 2
    }
  }

  // trim the edge curve with the node boundaries
  static trimSplineAndCalculateArrowheads(edge: GeomEdge, spline: ICurve, narrowestInterval: boolean): boolean {
    return Arrowhead.trimSplineAndCalculateArrowheadsII(
      edge,
      edge.source.boundaryCurve,
      edge.target.boundaryCurve,
      spline,
      narrowestInterval,
    )
  }

  // trim the edge curve with the node boundaries
  static trimSplineAndCalculateArrowheadsII(
    edgeGeometry: GeomEdge,
    sourceBoundary: ICurve,
    targetBoundary: ICurve,
    spline: ICurve,
    narrowestInterval: boolean,
  ): boolean {
    edgeGeometry.curve = Curve.trimEdgeSplineWithNodeBoundaries(sourceBoundary, targetBoundary, spline, narrowestInterval)
    if (edgeGeometry.curve == null) return false

    if (
      (edgeGeometry.sourceArrowhead == null || edgeGeometry.sourceArrowhead.length < GeomConstants.distanceEpsilon) &&
      (edgeGeometry.targetArrowhead == null || edgeGeometry.targetArrowhead.length < GeomConstants.distanceEpsilon)
    )
      return true //there are no arrowheads
    let success = false
    const sourceArrowheadSavedLength = edgeGeometry.sourceArrowhead != null ? edgeGeometry.sourceArrowhead.length : 0
    const targetArrowheadSavedLength = edgeGeometry.targetArrowhead != null ? edgeGeometry.targetArrowhead.length : 0
    const len = edgeGeometry.curve.end.sub(edgeGeometry.curve.start).length
    if (edgeGeometry.sourceArrowhead != null) edgeGeometry.sourceArrowhead.length = Math.min(len, sourceArrowheadSavedLength)
    if (edgeGeometry.targetArrowhead != null) edgeGeometry.targetArrowhead.length = Math.min(len, targetArrowheadSavedLength)
    let count = 10
    while (
      ((edgeGeometry.sourceArrowhead != null && edgeGeometry.sourceArrowhead.length > GeomConstants.intersectionEpsilon) ||
        (edgeGeometry.targetArrowhead != null && edgeGeometry.targetArrowhead.length > GeomConstants.intersectionEpsilon)) &&
      !success
    ) {
      success = Arrowhead.calculateArrowheads(edgeGeometry)
      if (!success) {
        if (edgeGeometry.sourceArrowhead != null) edgeGeometry.sourceArrowhead.length *= 0.5
        if (edgeGeometry.targetArrowhead != null) edgeGeometry.targetArrowhead.length *= 0.5
      }
      count--
      if (count === 0) break
    }

    if (!success) {
      //to avoid drawing the arrowhead to (0,0)
      if (edgeGeometry.sourceArrowhead != null) edgeGeometry.sourceArrowhead.tipPosition = spline.start
      if (edgeGeometry.targetArrowhead != null) edgeGeometry.targetArrowhead.tipPosition = spline.end
    }

    if (edgeGeometry.sourceArrowhead != null) edgeGeometry.sourceArrowhead.length = sourceArrowheadSavedLength
    if (edgeGeometry.targetArrowhead != null) edgeGeometry.targetArrowhead.length = targetArrowheadSavedLength

    return success
  }

  /** Creates a spline between two nodes big enough to draw arrowheads */
  static createBigEnoughSpline(edge: GeomEdge) {
    const a = edge.source.center
    let b = edge.target.center
    const bMinA = b.sub(a)

    const l = bMinA.length
    let perp: Point
    if (l < 0.001) {
      perp = new Point(1, 0)
      b = a.add(perp.rotate(Math.PI / 2))
    } else {
      perp = bMinA.rotate(Math.PI / 2)
    }

    let maxArrowLength = 1
    if (edge.sourceArrowhead != null) {
      maxArrowLength += edge.sourceArrowhead.length
    }
    if (edge.targetArrowhead != null) {
      maxArrowLength += edge.targetArrowhead.length
    }
    perp = perp.normalize().mul(1.5 * maxArrowLength)
    for (let i = 1; i < 10000; i = i * 2) {
      const seg = Curve.createBezierSegN(a, b, perp, i)
      if (Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, seg, false)) {
        return
      }
    }
    Arrowhead.createEdgeCurveWithNoTrimming(edge, a, b)
  }

  // this method should never be called: it is a super emergency measure
  static createEdgeCurveWithNoTrimming(edge: GeomEdge, a: Point, b: Point) {
    const ab = b.sub(a).normalize()

    let lineStart = a
    let lineEnd = b

    const targetArrow = edge.targetArrowhead
    if (targetArrow != null) {
      targetArrow.tipPosition = b
      lineEnd = b.sub(ab.mul(targetArrow.length))
    }
    const sourceArrow = edge.sourceArrowhead
    if (sourceArrow != null) {
      sourceArrow.tipPosition = a
      lineStart = a.add(ab.mul(sourceArrow.length))
    }
    edge.curve = LineSegment.mkPP(lineStart, lineEnd)
  }
}
