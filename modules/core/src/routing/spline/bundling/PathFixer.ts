﻿import {Point, Rectangle} from '../../..'
import {Polyline, LineSegment, GeomConstants, Curve} from '../../../math/geometry'
import {distPP, TriangleOrientation} from '../../../math/geometry/point'
import {PointPair} from '../../../math/geometry/pointPair'
import {PolylinePoint} from '../../../math/geometry/polylinePoint'
import {createRectangleNodeOnData} from '../../../math/geometry/RTree/rectangleNode'
import {CrossRectangleNodesSameType} from '../../../math/geometry/RTree/rectangleNodeUtils'
import {BinaryRTree} from '../../../math/geometry/RTree/rTree'
import {compareNumbers} from '../../../utils/compare'
import {PointMap} from '../../../utils/PointMap'
import {PointPairMap} from '../../../utils/pointPairMap'
import {PointSet} from '../../../utils/PointSet'
import {substractPointSets} from '../../../utils/setOperations'
import {FlipSwitcher} from './FlipSwitcher'
import {MetroGraphData} from './MetroGraphData'
import {Metroline} from './MetroLine'

export class PathFixer {
  metroGraphData: MetroGraphData

  polylineAcceptsPoint: (m: Metroline, p: Point) => boolean

  foundCrossings: PointSet = new PointSet()

  crossingsThatShouldBecomeHubs: PointSet = new PointSet()

  pointsToDelete: PointSet

  public constructor(metroGraphData: MetroGraphData, polylineAcceptsPoint: (m: Metroline, p: Point) => boolean) {
    this.metroGraphData = metroGraphData
    this.polylineAcceptsPoint = polylineAcceptsPoint
  }

  *Vertices(): IterableIterator<PolylinePoint> {
    for (const poly of this.Polylines) {
      for (const p of poly.polylinePoints()) {
        yield p
      }
    }
  }

  get Polylines(): Array<Polyline> {
    return this.metroGraphData.Edges.map((e) => <Polyline>e.curve)
  }

  Edges(): Array<PointPair> {
    const map = new PointPairMap<number>() // we need the keys only
    for (const pp of this.Vertices()) {
      if (pp.next) map.set(new PointPair(pp.point, pp.next.point), 0)
    }

    return Array.from(map.keys())
  }

  run(): boolean {
    if (this.metroGraphData.Edges.length === 0) {
      return false
    }

    const splittingPoints = new PointPairMap<Point[]>()
    const treeOfVertices = new BinaryRTree<Point, Point>(null)
    for (const vertex of this.Vertices()) {
      const r = Rectangle.mkOnPoints([vertex.point])
      r.pad(GeomConstants.intersectionEpsilon)
      treeOfVertices.Add(r, vertex.point)
    }
    const treeOfEdges = createRectangleNodeOnData(this.Edges(), (e) => Rectangle.mkPP(e.first, e.second))

    CrossRectangleNodesSameType<PointPair, Point>(treeOfEdges, treeOfEdges, (a, b) =>
      this.IntersectTwoEdges.bind(a, b, splittingPoints, treeOfVertices),
    )

    this.SortInsertedPoints(splittingPoints)
    const pointsInserted: boolean = this.InsertPointsIntoPolylines(splittingPoints)
    const progress: boolean = this.FixPaths()
    const pointsRemoved: boolean = this.RemoveUnimportantCrossings()
    return progress || pointsInserted || pointsRemoved
  }

  FixPaths(): boolean {
    let progress = false
    if (this.RemoveSelfCycles()) {
      progress = true
    }

    // if (CollapseCycles()) progress = true;
    if (this.ReduceEdgeCrossings()) {
      progress = true
    }

    return progress
  }

  SortInsertedPoints(splittingPoints: PointPairMap<Array<Point>>) {
    for (const pair of splittingPoints) this.SortInsideSegment(pair[0], pair[1])
  }

  SortInsideSegment(edge: PointPair, list: Array<Point>) {
    //System.Diagnostics.Debug.Assert(list.Count > 0, "an edge should not be present with an empty list");
    list.sort((a, b) => compareNumbers(distPP(a, edge.first), distPP(b, edge.first)))
  }

  InsertPointsIntoPolylines(splittingPoints: PointPairMap<Array<Point>>): boolean {
    let inserted = false
    for (const metroline of this.metroGraphData.Metrolines) {
      if (this.InsertPointsIntoPolyline(metroline, splittingPoints)) {
        inserted = true
      }

      return inserted
    }
  }

  InsertPointsIntoPolyline(metroline: Metroline, splittingPoints: PointPairMap<Array<Point>>): boolean {
    let inserted = false
    for (let pp = metroline.Polyline.startPoint; pp.next != null; pp = pp.next) {
      if (this.InsertPointsOnPolypoint(pp, splittingPoints, metroline)) {
        inserted = true
      }
    }

    return inserted
  }

  InsertPointsOnPolypoint(pp: PolylinePoint, splittingPoints: PointPairMap<Array<Point>>, metroline: Metroline): boolean {
    const pointPair = new PointPair(pp.point, pp.next.point)
    const reversed = pp.point !== pointPair.first
    const list: Array<Point> = splittingPoints.get(pointPair)
    if (!list) {
      return false
    }

    const endPolyPoint = pp.next
    const poly = pp.polyline
    if (reversed)
      for (let i = list.length - 1; i >= 0; i--) {
        if (this.polylineAcceptsPoint != null && !this.polylineAcceptsPoint(metroline, list[i])) continue
        const p = PolylinePoint.mkFromPoint(list[i])
        p.prev = pp
        p.polyline = poly
        pp.next = p
        pp = p
      }
    else
      for (let i = 0; i < list.length; i++) {
        if (this.polylineAcceptsPoint != null && !this.polylineAcceptsPoint(metroline, list[i])) continue
        const p = PolylinePoint.mkFromPoint(list[i])
        p.prev = pp
        p.polyline = poly
        pp.next = p
        pp = p
      }
    pp.next = endPolyPoint
    endPolyPoint.prev = pp
    return true
  }

  RemoveSelfCycles(): boolean {
    let progress = false
    for (const poly of this.Polylines)
      if (PathFixer.RemoveSelfCyclesFromPolyline(poly)) {
        progress = true
      }

    return progress
  }

  // returns removed points
  static RemoveSelfCyclesFromPolyline(poly: Polyline): boolean {
    let progress = false
    const pointsToPp = new PointMap<PolylinePoint>()
    for (let pp = poly.startPoint; pp != null; pp = pp.next) {
      const point = pp.point
      const previous: PolylinePoint = pointsToPp.get(point)
      if (previous) {
        // we have a cycle
        for (let px = previous.next; px !== pp.next; px = px.next) {
          pointsToPp.deleteP(px.point)
        }

        previous.next = pp.next
        pp.next.prev = previous
        progress = true
      } else {
        pointsToPp.set(pp.point, pp)
      }
    }

    return progress
  }

  // bool CollapseCycles() {
  //    var cycleCollapser = new FlipCollapser(metroGraphData, bundlingSettings, cdt);
  //    cycleCollapser.Run();
  //    crossingsThatShouldBecomeHubs.InsertRange(cycleCollapser.GetChangedCrossing());
  //    //TimeMeasurer.DebugOutput("#crossingsThatShouldBecomeHubs = " + crossingsThatShouldBecomeHubs.Count);
  //    return false;
  // }
  ReduceEdgeCrossings(): boolean {
    const cycleCollapser = new FlipSwitcher(this.metroGraphData)
    cycleCollapser.Run()

    for (const t of cycleCollapser.GetChangedHubs()) this.crossingsThatShouldBecomeHubs.add(t)
    // TimeMeasurer.DebugOutput("#reduced crossings = " + cycleCollapser.NumberOfReducedCrossings());
    return cycleCollapser.NumberOfReducedCrossings() > 0
  }

  RemoveUnimportantCrossings(): boolean {
    let removed = false
    this.pointsToDelete = substractPointSets(this.foundCrossings, this.crossingsThatShouldBecomeHubs)
    for (const polyline of this.Polylines) {
      if (this.RemoveUnimportantCrossingsFromPolyline(polyline)) {
        removed = true
      }
    }
    return removed
  }

  RemoveUnimportantCrossingsFromPolyline(polyline: Polyline): boolean {
    let removed = false
    for (let p = polyline.startPoint.next; p != null && p.next != null; p = p.next) {
      if (
        this.pointsToDelete.has(p.point) &&
        Point.getTriangleOrientation(p.prev.point, p.point, p.next.point) === TriangleOrientation.Collinear
      ) {
        // forget p
        const pp = p.prev
        const pn = p.next
        pp.next = pn
        pn.prev = pp
        p = pp
        removed = true
      }
    }

    return removed
  }

  IntersectTwoEdges(a: PointPair, b: PointPair, splittingPoints: PointPairMap<Array<Point>>, tree: BinaryRTree<Point, Point>) {
    const x: Point = LineSegment.IntersectPPPP(a.first, a.second, b.first, b.second)
    if (x) {
      const vertex: Point = this.FindExistingVertexOrCreateNew(tree, x)
      if (this.AddVertexToSplittingList(a, splittingPoints, vertex) || this.AddVertexToSplittingList(b, splittingPoints, vertex)) {
        this.foundCrossings.add(vertex)
      }
    }
  }

  FindExistingVertexOrCreateNew(tree: BinaryRTree<Point, Point>, x: Point): Point {
    const p = tree.RootNode.FirstHitNode(x)
    if (p != null) {
      return p.UserData
    }

    const rect = Rectangle.mkOnPoints([x])
    rect.pad(GeomConstants.intersectionEpsilon)
    tree.Add(rect, x)
    return x
  }

  AddVertexToSplittingList(a: PointPair, splittingPoints: PointPairMap<Array<Point>>, intersectionPoint: Point): boolean {
    //let t: number
    //Assert.assert(Point.distToLineSegment(intersectionPoint, a.First, a.Second, /* out */ t) < ApproximateComparer.IntersectionEpsilon)
    if (!Curve.closeIntersectionPoints(intersectionPoint, a.first) && !Curve.closeIntersectionPoints(intersectionPoint, a.second)) {
      let list: Array<Point> = splittingPoints.get(a)
      if (!list) {
        list = new Array<Point>()
        splittingPoints.set(a, list)
      }

      if (!list.find((p) => p.equal(intersectionPoint))) {
        list.push(intersectionPoint)
        return true
      }
    }

    return false
  }
}
