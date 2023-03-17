﻿import {Point, ICurve, GeomEdge} from '../../..'
import {Curve, LineSegment, GeomConstants, CurveFactory} from '../../../math/geometry'
import {BezierSeg} from '../../../math/geometry/bezierSeg'
import {DebugCurve} from '../../../math/geometry/debugCurve'
import {Ellipse} from '../../../math/geometry/ellipse'
import {distPP} from '../../../math/geometry/point'
import {PolylinePoint} from '../../../math/geometry/polylinePoint'
import {Algorithm} from '../../../utils/algorithm'
import {BundlingSettings} from '../../BundlingSettings'
import {BundleBase} from './BundleBase'
import {BundleBasesCalculator} from './BundleBasesCalculator'
import {HubRadiiCalculator} from './HubRadiiCalculator'
import {GeneralMetroMapOrdering} from './GeneralMetroMapOrdering'
import {MetroGraphData} from './MetroGraphData'
import {Metroline} from './MetroLine'
import {OrientedHubSegment} from './OrientedHubSegment'
import {Station} from './Station'
//
// import {Assert} from '../../../utils/assert'
/** this class nudges the edges, sorts the edges that run in parallel in a way that minimezes the number of crossings*/
export class EdgeNudger extends Algorithm {
  bundlingSettings: BundlingSettings

  metroGraphData: MetroGraphData

  metroOrdering: GeneralMetroMapOrdering

  // Constructor
  constructor(metroGraphData: MetroGraphData, bundlingSettings: BundlingSettings) {
    super(null)
    this.metroGraphData = metroGraphData
    this.bundlingSettings = bundlingSettings
  }
  run() {
    this.CreateMetroOrdering()
    this.InitRadii()
    this.FinalizePaths()
  }

  InitRadii() {
    new HubRadiiCalculator(this.metroGraphData, this.bundlingSettings).CreateNodeRadii()
  }

  // bundle-map ordering
  CreateMetroOrdering() {
    this.metroOrdering = new GeneralMetroMapOrdering(this.metroGraphData.Metrolines)
  }

  FinalizePaths() {
    this.CreateBundleBases()
    this.CreateSegmentsInsideHubs()
    this.CreateCurves()
  }

  CreateBundleBases() {
    const bbCalc = new BundleBasesCalculator(this.metroOrdering, this.metroGraphData, this.bundlingSettings)
    bbCalc.Run()
  }

  CreateCurves() {
    //Assert.assert(this.metroGraphData.Metrolines.length === this.metroGraphData.Edges.length)
    for (let i = 0; i < this.metroGraphData.Metrolines.length; i++) {
      this.CreateCurveLine(this.metroGraphData.Metrolines[i], this.metroGraphData.Edges[i])
    }
  }

  CreateCurveLine(line: Metroline, edge: GeomEdge) {
    const c = new Curve()
    const start: Point = EdgeNudger.FindCurveStart(this.metroGraphData, this.metroOrdering, line)
    let currentEnd: Point = start
    const hubSegsOfLine = EdgeNudger.HubSegsOfLine(this.metroGraphData, this.metroOrdering, line)
    for (const seg of hubSegsOfLine) {
      if (seg == null) {
        continue
      }

      c.addSegment(LineSegment.mkPP(currentEnd, seg.start))
      c.addSegment(seg)
      currentEnd = seg.end
    }
    c.addSegment(LineSegment.mkPP(currentEnd, EdgeNudger.FindCurveEnd(this.metroGraphData, this.metroOrdering, line)))
    edge.curve = c
  }

  static FindCurveStart(metroGraphData: MetroGraphData, metroOrdering: GeneralMetroMapOrdering, metroline: Metroline): Point {
    const u: Station = metroGraphData.PointToStations.get(metroline.Polyline.startPoint.point)
    const v: Station = metroGraphData.PointToStations.get(metroline.Polyline.startPoint.next.point)
    const bb: BundleBase = u.BundleBases.get(v)
    const index: number = !bb.IsParent
      ? metroOrdering.GetLineIndexInOrder(v, u, metroline)
      : metroOrdering.GetLineIndexInOrder(u, v, metroline)
    return bb.Points[index]
  }

  static FindCurveEnd(metroGraphData: MetroGraphData, metroOrdering: GeneralMetroMapOrdering, metroline: Metroline): Point {
    const u: Station = metroGraphData.PointToStations.get(metroline.Polyline.endPoint.prev.point)
    const v: Station = metroGraphData.PointToStations.get(metroline.Polyline.endPoint.point)
    const bb: BundleBase = v.BundleBases.get(u)
    const index = !bb.IsParent ? metroOrdering.GetLineIndexInOrder(u, v, metroline) : metroOrdering.GetLineIndexInOrder(v, u, metroline)
    return bb.Points[index]
  }

  static *HubSegsOfLine(metroGraphData: MetroGraphData, metroOrdering: GeneralMetroMapOrdering, line: Metroline): IterableIterator<ICurve> {
    for (let i = line.Polyline.startPoint.next; i.next != null; i = i.next)
      yield EdgeNudger.SegOnLineVertex(metroGraphData, metroOrdering, line, i)
  }

  static SegOnLineVertex(
    metroGraphData: MetroGraphData,
    metroOrdering: GeneralMetroMapOrdering,
    line: Metroline,
    i: PolylinePoint,
  ): ICurve {
    const u: Station = metroGraphData.PointToStations.get(i.prev.point)
    const v: Station = metroGraphData.PointToStations.get(i.point)
    const h0: BundleBase = v.BundleBases.get(u)
    const j0: number = metroOrdering.GetLineIndexInOrder(u, v, line)
    if (h0.OrientedHubSegments[j0] == null || h0.OrientedHubSegments[j0].Segment == null) {
      const w = metroGraphData.PointToStations.get(i.next.point)
      const otherBase = v.BundleBases.get(w)
      const j1 = metroOrdering.GetLineIndexInOrder(w, v, line)
      return LineSegment.mkPP(h0.Points[j0], otherBase.Points[j1])
    }

    return h0.OrientedHubSegments[j0].Segment
  }

  CreateSegmentsInsideHubs() {
    for (const metroline of this.metroGraphData.Metrolines) {
      this.CreateOrientedSegsOnLine(metroline)
    }
    if (this.bundlingSettings.UseCubicBezierSegmentsInsideOfHubs) {
      this.FanBezierSegs()
    }
  }

  CreateOrientedSegsOnLine(line: Metroline) {
    for (let polyPoint: PolylinePoint = line.Polyline.startPoint.next; polyPoint.next != null; polyPoint = polyPoint.next) {
      this.CreateICurveForOrientedSeg(line, polyPoint)
    }
  }

  CreateICurveForOrientedSeg(line: Metroline, polyPoint: PolylinePoint) {
    const u: Station = this.metroGraphData.PointToStations.get(polyPoint.prev.point)
    const v: Station = this.metroGraphData.PointToStations.get(polyPoint.point)
    const w: Station = this.metroGraphData.PointToStations.get(polyPoint.next.point)
    const h0: BundleBase = v.BundleBases.get(u)
    const h1: BundleBase = v.BundleBases.get(w)
    const j0: number = this.metroOrdering.GetLineIndexInOrder(u, v, line)
    const j1: number = this.metroOrdering.GetLineIndexInOrder(w, v, line)
    const seg = this.bundlingSettings.UseCubicBezierSegmentsInsideOfHubs
      ? EdgeNudger.StandardBezier(h0.Points[j0], h0.Tangents[j0], h1.Points[j1], h1.Tangents[j1])
      : EdgeNudger.BiArc(h0.Points[j0], h0.Tangents[j0], h1.Points[j1], h1.Tangents[j1])
    h0.OrientedHubSegments[j0].Segment = seg
    h1.OrientedHubSegments[j1].Segment = seg
    // if (seg instanceof BezierSeg) {
    //  const dc = [
    //    DebugCurve.mkDebugCurveTWCI(200, 1, 'Blue', LineSegment.mkPP(h1.Points[0], h1.Points[h1.length - 1])),
    //    DebugCurve.mkDebugCurveTWCI(200, 1, 'Black', LineSegment.mkPP(h0.Points[0], h0.Points[h0.length - 1])),
    //    DebugCurve.mkDebugCurveTWCI(200, 0.5, 'Red', LineSegment.mkPP(h0.Points[j0], h0.Points[j0].add(h0.Tangents[j0]))),
    //    DebugCurve.mkDebugCurveTWCI(200, 0.5, 'Green', LineSegment.mkPP(h1.Points[j1], h1.Points[j1].add(h1.Tangents[j1]))),
    //  ]
    //  dc.push(DebugCurve.mkDebugCurveTWCI(200, 0.1, 'Brown', seg))
    //  dc.push(DebugCurve.mkDebugCurveTWCI(100, 1, 'Pink', line.Polyline))
    //  dc.push(DebugCurve.mkDebugCurveTWCI(100, 1, 'Tan', u.BoundaryCurve))
    //  dc.push(DebugCurve.mkDebugCurveTWCI(100, 1, 'Plum', v.BoundaryCurve))
    //  dc.push(DebugCurve.mkDebugCurveTWCI(100, 1, 'DarkOrange', w.BoundaryCurve))
    //  SvgDebugWriter.dumpDebugCurves('./tmp/hubs' + EdgeNudger.debCount + '.svg', dc)
    // }
  }

  static ShowHubs(
    metroGraphData: MetroGraphData,
    metroMapOrdering: GeneralMetroMapOrdering,
    station: Station,
    fileName: string,
    moreCurves: DebugCurve[] = [],
  ) {
    let ttt = EdgeNudger.GetAllDebugCurves(metroMapOrdering, metroGraphData)
    if (station != null) {
      ttt.push(DebugCurve.mkDebugCurveTWCI(255, 1, 'red', CurveFactory.mkDiamond(5, 25, station.Position)))
    }
    ttt = ttt.concat(moreCurves)
    // SvgDebugWriter.dumpDebugCurves(fileName, ttt) // uncomment this line to get the SVG output
  }

  static GetAllDebugCurves(metroMapOrdering: GeneralMetroMapOrdering, metroGraphData: MetroGraphData): Array<DebugCurve> {
    return EdgeNudger.GraphNodes(metroGraphData)
      .concat(EdgeNudger.VertexDebugCurves(metroMapOrdering, metroGraphData))
      .concat(EdgeNudger.DebugEdges(metroGraphData))
  }

  static DebugEdges(metroGraphData1: MetroGraphData): Array<DebugCurve> {
    return metroGraphData1.Edges.map((e) => DebugCurve.mkDebugCurveTWCI(40, 0.1, 'gray', e.curve))
  }

  static VertexDebugCurves(metroMapOrdering: GeneralMetroMapOrdering, metroGraphData: MetroGraphData): Array<DebugCurve> {
    return EdgeNudger.DebugCircles(metroGraphData)
      .concat(EdgeNudger.DebugHubBases(metroGraphData))
      .concat(EdgeNudger.DebugSegs(metroGraphData))
      .concat(EdgeNudger.BetweenHubs(metroMapOrdering, metroGraphData))
  }

  static BetweenHubs(metroMapOrdering: GeneralMetroMapOrdering, metroGraphData: MetroGraphData): Array<DebugCurve> {
    const ret = []
    for (const ml of metroGraphData.Metrolines) {
      const segs: Array<[Point, Point]> = EdgeNudger.GetInterestingSegs(metroGraphData, metroMapOrdering, ml)
      const color: string = EdgeNudger.GetMonotoneColor(ml.Polyline.start, ml.Polyline.end, segs)
      for (const seg of segs) {
        ret.push(DebugCurve.mkDebugCurveTWCI(100, ml.Width, color, LineSegment.mkPP(seg[0], seg[1])))
      }
    }
    return ret
  }

  static GetInterestingSegs(
    metroGraphData: MetroGraphData,
    metroMapOrdering: GeneralMetroMapOrdering,
    line: Metroline,
  ): Array<[Point, Point]> {
    const ret = new Array<[Point, Point]>()
    if (
      metroGraphData.Stations.length === 0 ||
      metroGraphData.Stations[0].BundleBases == null ||
      metroGraphData.Stations[0].BundleBases.size === 0
    )
      return []
    let start: Point = EdgeNudger.FindCurveStart(metroGraphData, metroMapOrdering, line)
    const cubicSegs = EdgeNudger.HubSegsOfLine(metroGraphData, metroMapOrdering, line)
    for (const seg of cubicSegs) {
      if (seg == null) {
        continue
      }

      ret.push([start, seg.start])

      start = seg.end
    }
    ret.push([start, EdgeNudger.FindCurveEnd(metroGraphData, metroMapOrdering, line)])
    return ret
  }

  static GetMonotoneColor(start: Point, end: Point, segs: Array<[Point, Point]>): string {
    return 'green'
    //            Point dir = end - start;
    //            bool monotone = segs.All(seg => (seg.Second - seg.First)*dir >= 0);
    //            return monotone ? "green" : "magenta";
  }

  static DebugHubBases(metroGraphData: MetroGraphData): Array<DebugCurve> {
    const dc: Array<DebugCurve> = new Array<DebugCurve>()
    for (const s of metroGraphData.Stations) {
      for (const h of s.BundleBases.values()) {
        dc.push(DebugCurve.mkDebugCurveTWCI(100, 1, 'red', LineSegment.mkPP(h.EndPoint, h.StartPoint)))
      }
    }
    return dc
    // return
    //    metroGraphData.Stations.SelectMany(s => s.BundleBases.Values).Select(
    //        h => new DebugCurve(100, 0.01, "red", new LineSegment(h.Points[0], h.Points.Last())));
  }

  static DebugCircles(metroGraphData: MetroGraphData): Array<DebugCurve> {
    return metroGraphData.Stations.map((station) =>
      DebugCurve.mkDebugCurveTWCI(100, 0.1, 'blue', CurveFactory.mkCircle(station.Radius, station.Position)),
    )
  }

  static DebugSegs(metroGraphData: MetroGraphData): Array<DebugCurve> {
    const ls = new Array<ICurve>()
    for (const s of metroGraphData.VirtualStations()) {
      for (const b of s.BundleBases.values()) {
        for (const h of b.OrientedHubSegments) {
          if (h == null) {
            continue
          }

          if (h.Segment == null) {
            const uBase = h.Other.BundleBase
            const i = h.Index
            const j = h.Other.Index
            ls.push(LineSegment.mkPP(b.Points[i], uBase.Points[j]))
          } else {
            ls.push(h.Segment)
          }
        }
      }
    }
    return ls.map((s) => DebugCurve.mkDebugCurveTWCI(100, 0.01, 'green', s))
  }

  static GraphNodes(metroGraphData: MetroGraphData): Array<DebugCurve> {
    const nodes = metroGraphData.Edges.map((e) => e.sourcePort.Curve).concat(metroGraphData.Edges.map((e) => e.targetPort.Curve))
    return nodes.map((n) => DebugCurve.mkDebugCurveTWCI(40, 1, 'black', n))
  }

  static BiArc(p0: Point, ts: Point, p4: Point, te: Point): ICurve {
    //Assert.assert(closeDistEps(ts.lengthSquared, 1))
    //Assert.assert(closeDistEps(te.lengthSquared, 1))
    const v = p0.sub(p4)
    if (v.length < GeomConstants.distanceEpsilon) return null

    const vtse = v.dot(ts.sub(te))
    const tste = -ts.dot(te)

    //bad input for BiArc. we shouldn't allow such cases during bundle bases construction
    if (ts.dot(p4.sub(p0)) <= 0 && ts.dot(te) <= 0) {
      //switch to Bezier
      return EdgeNudger.StandardBezier(p0, ts, p4, te)
    }
    //solving a quadratic equation
    const a = 2 * (tste - 1)
    const b = 2 * vtse
    const c = v.dot(v)
    let al: number
    if (Math.abs(a) < GeomConstants.distanceEpsilon) {
      //we have b*al+c=0
      if (Math.abs(b) > GeomConstants.distanceEpsilon) {
        al = -c / b
      } else {
        return null
      }
    } else {
      let d = b * b - 4 * a * c
      //Assert.assert(d >= -GeomConstants.tolerance)
      if (d < 0) d = 0
      d = Math.sqrt(d)
      al = (-b + d) / (2 * a)
      if (al < 0) al = (-b - d) / (2 * a)
    }

    const p1 = p0.add(ts.mul(al))
    const p3 = p4.add(te.mul(al))
    const p2 = Point.middle(p1, p3)
    const orient1 = Point.getTriangleOrientation(p0, p1, p2)
    const orient2 = Point.getTriangleOrientation(p2, p3, p4)
    if (orient1 !== orient2) {
      return EdgeNudger.StandardBezier(p0, ts, p4, te)
    }
    const curve = new Curve()
    curve.addSegs([EdgeNudger.ArcOn(p0, p1, p2), EdgeNudger.ArcOn(p2, p3, p4)])
    return curve
  }

  // returns the arc that a,b,c touches
  static ArcOn(a: Point, b: Point, c: Point): ICurve {
    const t: {center: Point} = {center: null}
    if (Math.abs(Point.signedDoubledTriangleArea(a, b, c)) < 0.0001 || !EdgeNudger.FindArcCenter(a, b, c, t)) {
      return LineSegment.mkPP(a, c)
    }
    const center = t.center
    const radius = distPP(a, center)
    const chordLength = distPP(a, b)
    if (chordLength / radius < 0.0001) {
      return LineSegment.mkPP(a, c)
    }

    const cenA = a.sub(center)
    let aAngle = Math.atan2(cenA.y, cenA.x)
    const cenC = c.sub(center)
    let cAngle = Math.atan2(cenC.y, cenC.x)
    let delac = cAngle - aAngle
    if (delac < 0) {
      delac += 2 * Math.PI
      cAngle += 2 * Math.PI
    }

    if (delac <= Math.PI) {
      // going ccw
      const el = new Ellipse(aAngle, cAngle, new Point(radius, 0), new Point(0, radius), center)
      return el
    }

    // going clockwise
    if (cAngle > 2 * Math.PI) {
      cAngle -= 2 * Math.PI
    }

    aAngle = Math.PI - aAngle
    cAngle = Math.PI - cAngle
    if (aAngle < 0) {
      aAngle += 2 * Math.PI
    }

    while (cAngle < aAngle) {
      cAngle += 2 * Math.PI
    }

    delac = cAngle - aAngle
    //Assert.assert(delac <= Math.PI)
    return new Ellipse(aAngle, cAngle, new Point(-radius, 0), new Point(0, radius), center)
  }

  static FindArcCenter(a: Point, b: Point, c: Point, t: {center: Point}): boolean {
    const perp0 = b.sub(a).rotate90Cw()
    const perp1 = b.sub(c).rotate90Cw()
    t.center = Point.lineLineIntersection(a, a.add(perp0), c, c.add(perp1))
    return t.center != null
  }

  static StandardBezier(segStart: Point, tangentAtStart: Point, segEnd: Point, tangentAtEnd: Point): BezierSeg {
    const len: number = distPP(segStart, segEnd) / 4
    return BezierSeg.mkBezier([segStart, segStart.add(tangentAtStart.mul(len)), segEnd.add(tangentAtEnd.mul(len)), segEnd])
  }

  FanBezierSegs() {
    let progress = true
    const maxSteps = 5
    let steps = 0
    while (progress && steps++ < maxSteps) {
      progress = false
      for (const s of this.metroGraphData.Stations)
        for (const segmentHub of s.BundleBases.values()) progress ||= this.FanEdgesOfHubSegment(segmentHub)
    }
  }

  FanEdgesOfHubSegment(bundleHub: BundleBase): boolean {
    let ret = false
    for (let i = 0; i < bundleHub.Count - 1; i++) {
      ret ||= this.FanCouple(bundleHub, i, bundleHub.CurveCenter, bundleHub.Curve.boundingBox.diagonal / 2)
    }

    return ret
  }

  // fans the couple i,i+1
  FanCouple(bundleHub: BundleBase, i: number, center: Point, radius: number): boolean {
    const lSeg: OrientedHubSegment = bundleHub.OrientedHubSegments[i]
    const rSeg: OrientedHubSegment = bundleHub.OrientedHubSegments[i + 1]
    if (lSeg == null) {
      return false
    }

    const x: Point = LineSegment.IntersectPPPP(lSeg.Segment.start, lSeg.Segment.end, rSeg.Segment.start, rSeg.Segment.end)
    if (x) {
      // it doesn not make sense to push these segs apart
      return false
    }

    if (
      Point.getTriangleOrientation(lSeg.value(0), lSeg.value(0.5), lSeg.value(1)) !=
      Point.getTriangleOrientation(rSeg.value(0), rSeg.value(0.5), rSeg.value(1))
    ) {
      return false
    }

    const ll: number = this.BaseLength(lSeg)
    const rl: number = this.BaseLength(rSeg)
    if (Math.abs(ll - rl) < GeomConstants.intersectionEpsilon) {
      return false
    }

    if (ll > rl) {
      return this.AdjustLongerSeg(lSeg, rSeg, center, radius)
    }

    return this.AdjustLongerSeg(rSeg, lSeg, center, radius)
  }

  AdjustLongerSeg(longerSeg: OrientedHubSegment, shorterSeg: OrientedHubSegment, center: Point, radius: number): boolean {
    const del0: Point = longerSeg.value(0).sub(shorterSeg.value(0))
    const del1: Point = longerSeg.value(1).sub(shorterSeg.value(1))
    const minDelLength: number = Math.min(del0.length, del1.length)
    const midPointOfShorter: Point = shorterSeg.value(0.5)
    const maxDelLen: number = Math.max(del0.length, del1.length)
    if (this.NicelyAligned(<BezierSeg>longerSeg.Segment, del0, del1, midPointOfShorter, minDelLength, maxDelLen) === 0) {
      return false
    }

    return this.FitLonger(longerSeg, del0, del1, midPointOfShorter, minDelLength, maxDelLen, center, radius)
  }

  /* const */ static SqueezeBound = 0.2

  FitLonger(
    longerOrientedSeg: OrientedHubSegment,
    del0: Point,
    del1: Point,
    midPointOfShorter: Point,
    minDelLength: number,
    maxDel: number,
    center: Point,
    radius: number,
  ): boolean {
    let seg: BezierSeg = <BezierSeg>longerOrientedSeg.Segment
    const start: Point = seg.start
    const end: Point = seg.end
    // LayoutAlgorithmSettings.ShowDebugCurves(new DebugCurve("green", shorterDebugOnly), new DebugCurve("red", seg));
    let steps = 0
    const maxSteps = 10
    let lowP1: Point = seg.start.mul(1 - EdgeNudger.SqueezeBound).add(seg.B(1).mul(EdgeNudger.SqueezeBound))
    let lowP2: Point = seg.end.mul(1 - EdgeNudger.SqueezeBound).add(seg.B(2).mul(EdgeNudger.SqueezeBound))
    let highP1: Point = seg.B(1).mul(2).sub(seg.start)
    // originally the tangents were 0.25 of the length of seg[1]-seg[0] - so were are safe to lengthen two times
    let highP2: Point = seg.B(2).mul(2).sub(seg.end)

    const t = {highP: highP1}
    this.PullControlPointToTheCircle(seg.start, t, center, radius)
    highP1 = t.highP
    let r: number = this.NicelyAligned(seg, del0, del1, midPointOfShorter, minDelLength, maxDel)
    do {
      if (r === -1) {
        // pull the control points lower
        const p1: Point = Point.middle(seg.B(1), lowP1)

        const p2: Point = Point.middle(seg.B(2), lowP2)
        highP1 = seg.B(1)
        highP2 = seg.B(2)
        seg = new BezierSeg(start, p1, p2, end)
      } else {
        //Assert.assert(r === 1)
        // pull the control points higher
        const p1: Point = Point.middle(seg.B(1), highP1)

        const p2: Point = (seg.B(2), highP2)

        lowP1 = seg.B(1)
        lowP2 = seg.B(2)
        seg = new BezierSeg(start, p1, p2, end)
      }

      if ((r = this.NicelyAligned(seg, del0, del1, midPointOfShorter, minDelLength, maxDel)) === 0) {
        longerOrientedSeg.Segment = seg
        longerOrientedSeg.Other.Segment = seg
        return true
      }

      if (steps++ > maxSteps) return false //cannot fix it
      // cannot fix it
    } while (true)
  }

  PullControlPointToTheCircle(start: Point, t: {highP: Point}, center: Point, radius: number) {
    const closestPointOnLine: Point = Point.ProjectionToLine(start, t.highP, center)
    // the max offset from closestPointOnLine
    const maxOffset: number = Math.sqrt(radius * radius - closestPointOnLine.sub(center).lengthSquared)
    const offsetNow: Point = t.highP.sub(closestPointOnLine)
    const offsetLen: number = offsetNow.length
    if (offsetLen > maxOffset) {
      t.highP = closestPointOnLine.add(offsetNow.mul(maxOffset / offsetLen))
    }
  }

  //
  NicelyAligned(longerSeg: BezierSeg, del0: Point, del1: Point, midPointOfShorter: Point, minDelLength: number, maxDelLen: number): number {
    const eps = 0.001
    const midDel: Point = longerSeg.value(0.5).sub(midPointOfShorter)
    const midDelLen: number = midDel.length
    if (del0.dot(midDel) < 0 || del1.dot(midDel) < 0) {
      return 1
    }

    if (midDelLen < minDelLength - eps) {
      return 1
    }

    if (midDelLen > maxDelLen + eps) {
      return -1
    }

    return 0
  }

  BaseLength(seg: OrientedHubSegment): number {
    return seg.value(0).sub(seg.value(1)).lengthSquared
  }
}
