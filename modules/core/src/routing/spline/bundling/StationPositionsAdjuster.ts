import {Stack} from 'stack-typescript'
import {Point} from '../../..'
import {Polyline, LineSegment, Rectangle} from '../../../math/geometry'
import {distPP} from '../../../math/geometry/point'
import {PointPair} from '../../../math/geometry/pointPair'
import {PolylinePoint} from '../../../math/geometry/polylinePoint'
import {CreateRectNodeOnArrayOfRectNodes, mkRectangleNode, RectangleNode} from '../../../math/geometry/RTree/rectangleNode'
import {CrossRectangleNodesSameType} from '../../../math/geometry/RTree/rectangleNodeUtils'

import {PointPairMap} from '../../../utils/pointPairMap'
import {PointSet} from '../../../utils/PointSet'
import {
  addToPointPairMap,
  addToPointMapTuple,
  removeFromPointPairMapTuple,
  setIntersection,
  setIntersectionOfArray,
  substractSets,
  uniteSets,
  setsAreEqual,
} from '../../../utils/setOperations'
import {BundlingSettings} from '../../BundlingSettings'
import {InteractiveEdgeRouter} from '../../interactiveEdgeRouter'
import {CostCalculator} from './CostCalculator'
import {HubRadiiCalculator} from './HubRadiiCalculator'
import {MetroGraphData} from './MetroGraphData'
import {Metroline} from './MetroLine'
import {PathFixer} from './PathFixer'
import {SimulatedAnnealing} from './SimulatedAnnealing'
import {Station} from './Station'
import {TupleMap} from './tupleMap'

// Adjust current bundle-routing with a number of heuristic
export class StationPositionsAdjuster {
  // Algorithm settings
  bundlingSettings: BundlingSettings

  // bundle data
  metroGraphData: MetroGraphData

  constructor(metroGraphData: MetroGraphData, bundlingSettings: BundlingSettings) {
    this.metroGraphData = metroGraphData
    this.bundlingSettings = bundlingSettings
  }

  /**  apply a number of heuristics to improve current routing */
  static FixRouting(metroGraphData: MetroGraphData, bundlingSettings: BundlingSettings) {
    const adjuster = new StationPositionsAdjuster(metroGraphData, bundlingSettings)
    adjuster.GlueConflictingStations()
    adjuster.UnglueEdgesFromBundleToSaveInk(true)
    let step = 0
    const MaxSteps = 10
    while (++step < MaxSteps) {
      // heuristics to improve routing
      let progress: boolean = adjuster.GlueConflictingStations()
      progress ||= adjuster.RelaxConstrainedEdges()
      progress ||= step <= 3 && adjuster.UnglueEdgesFromBundleToSaveInk(false)
      progress ||= adjuster.GlueCollinearNeighbors(step)
      progress ||= step === 3 && adjuster.RemoveDoublePathCrossings()
      if (!progress) {
        break
      }
    }

    //one SA has to be executed with bundle forces
    metroGraphData.cdtIntersections.ComputeForcesForBundles = true
    adjuster.RemoveDoublePathCrossings()
    adjuster.UnglueEdgesFromBundleToSaveInk(true)
    while (adjuster.GlueConflictingStations()) {}
    metroGraphData.Initialize(true)
    //this time initialize the tight enterables also
    // this time initialize the tight enterables also
    //            HubDebugger.ShowHubs(metroGraphData, bundlingSettings);
    // TimeMeasurer.DebugOutput("NodePositionsAdjuster stopped after " + step + " steps");
    // HubDebugger.ShowHubs(metroGraphData, bundlingSettings, true);
    // TimeMeasurer.DebugOutput("Final cost: " + CostCalculator.Cost(metroGraphData, bundlingSettings));
    // TimeMeasurer.DebugOutput("Final cost of forces: " + CostCalculator.CostOfForces(metroGraphData, bundlingSettings));
  }

  /** unite the nodes that are close to each other */
  GlueConflictingStations(): boolean {
    //Assert.assert(SimulatedAnnealing.stationsArePositionedCorrectly(this.metroGraphData))
    const circlesHierarchy = this.GetCirclesHierarchy()
    if (circlesHierarchy == null) {
      return false
    }

    const gluingMap = new Map<Station, Station>()
    const gluedDomain = new Set<Station>()
    CrossRectangleNodesSameType<Station, Point>(circlesHierarchy, circlesHierarchy, (i, j) =>
      this.TryToGlueStations(i, j, gluingMap, gluedDomain),
    )
    if (gluingMap.size === 0) {
      return false
    }
    //Assert.assert(SimulatedAnnealing.stationsArePositionedCorrectly(this.metroGraphData))

    for (let i = 0; i < this.metroGraphData.Edges.length; i++) {
      this.RegenerateEdge(gluingMap, i)
    }
    const affectedPoints = new PointSet()
    for (const s of gluedDomain) {
      affectedPoints.add(s.Position)
      for (const neig of s.Neighbors) if (!neig.IsReal) affectedPoints.add(neig.Position)
    }
    // TimeMeasurer.DebugOutput("gluing nodes");
    this.metroGraphData.Initialize(false)
    SimulatedAnnealing.FixRoutingMBP(this.metroGraphData, this.bundlingSettings, affectedPoints)
    return true
  }

  GetCirclesHierarchy(): RectangleNode<Station, Point> {
    for (const v of this.metroGraphData.VirtualStations()) v.Radius = this.GetCurrentHubRadius(v)
    const t = this.metroGraphData.VirtualStations().map(rectNodeOfStation)
    return CreateRectNodeOnArrayOfRectNodes(t)

    function rectNodeOfStation(i: Station) {
      const p = i.Position
      const r = Math.max(i.Radius, 5)
      const del = new Point(r, r)
      const b = Rectangle.mkPP(p.add(del), p.sub(del))
      return mkRectangleNode(i, b)
    }
  }

  GetCurrentHubRadius(node: Station): number {
    if (node.IsReal) {
      return node.BoundaryCurve.boundingBox.diagonal / 2
    } else {
      const idealR = node.cachedIdealRadius
      //TODO: which one?
      let r = this.metroGraphData.looseIntersections.GetMinimalDistanceToObstacles(node, node.Position, idealR)
      //const r = idealR;
      //Assert.assert(r <= idealR)
      for (const adj of node.Neighbors) r = Math.min(r, node.Position.sub(adj.Position).length)
      return r
    }
  }

  TryToGlueStations(i: Station, j: Station, gluingMap: Map<Station, Station>, gluedDomain: Set<Station>): boolean {
    //Assert.assert(i !== j)
    if (!setsAreEqual(i.getELP(), j.getELP())) return false
    const d: number = i.Position.sub(j.Position).length
    const r1: number = Math.max(i.Radius, 5)
    const r2: number = Math.max(j.Radius, 5)
    if (d >= r1 + r2) {
      return
    }

    // we are greedily trying to glue i to j
    if (!this.TryGlueOrdered(i, j, gluedDomain, gluingMap)) {
      this.TryGlueOrdered(j, i, gluedDomain, gluingMap)
    }
  }

  TryGlueOrdered(i: Station, j: Station, gluedDomain: Set<Station>, gluingMap: Map<Station, Station>): boolean {
    if (!gluingMap.has(i) && !gluedDomain.has(i) && this.StationGluingIsAllowed(i, j, gluingMap)) {
      this.Map(i, j, gluedDomain, gluingMap)
      // TimeMeasurer.DebugOutput("gluing nodes " + i.serialNumber + " and " + j.serialNumber);
      return true
    }

    return false
  }

  Map(i: Station, j: Station, gluedDomain: Set<Station>, gluingMap: Map<Station, Station>) {
    gluingMap.set(i, j)
    gluedDomain.add(j)
  }

  /**  trying to glue i to j */
  StationGluingIsAllowed(i: Station, j: Station, gluingMap: Map<Station, Station>): boolean {
    for (const adj of i.Neighbors) {
      const k = StationPositionsAdjuster.Glued(adj, gluingMap)
      //1. check that we can merge these stations (== no intersections)
      const obstaclesToIgnore = this.metroGraphData.looseIntersections.ObstaclesToIgnoreForBundle(k, i)
      if (!this.metroGraphData.cdtIntersections.EdgeIsLegalSSPPS(k, j, obstaclesToIgnore)) return false
    }

    //2. check that cost of the routing is reduced
    const delta = this.ComputeCostDeltaAfterStationGluing(i, j, gluingMap)
    if (delta < 0) return false

    return true
  }

  ComputeCostDeltaAfterStationGluing(i: Station, j: Station, gluingMap: Map<Station, Station>): number {
    const d: number = i.Position.sub(j.Position).length
    if (i.Radius >= d || j.Radius >= d) {
      return 1
    }

    let gain = 0
    // ink
    const oldInk = this.metroGraphData.Ink
    let newInk = this.metroGraphData.Ink - j.Position.sub(i.Position).length
    for (const adj of i.Neighbors) {
      const k = StationPositionsAdjuster.Glued(adj, gluingMap)
      newInk -= k.Position.sub(i.Position).length
      newInk += this.metroGraphData.RealEdgeCount(k, j) === 0 ? k.Position.sub(j.Position).length : 0
    }

    gain += CostCalculator.InkError(oldInk, newInk, this.bundlingSettings)

    //path lengths
    for (const metroInfo of this.metroGraphData.MetroNodeInfosOfNode(i)) {
      const oldLength = metroInfo.Metroline.Length
      let newLength = metroInfo.Metroline.Length

      const pi = metroInfo.PolyPoint
      const pa = pi.prev
      const pb = pi.next

      newLength -= pa.point.sub(i.Position).length + pb.point.sub(i.Position).length
      newLength += pa.point.sub(j.Position).length + pb.point.sub(j.Position).length

      gain += CostCalculator.PathLengthsError(oldLength, newLength, metroInfo.Metroline.IdealLength, this.bundlingSettings)
    }

    return gain
  }

  RegenerateEdge(gluingMap: Map<Station, Station>, edgeIndex: number) {
    const poly = this.metroGraphData.Metrolines[edgeIndex].Polyline

    for (const p of poly) {
      if (!this.metroGraphData.PointToStations.has(p)) {
        return
      }
    }
    let atLeastOnGlued = false

    for (const p of poly) {
      if (gluingMap.has(this.metroGraphData.PointToStations.get(p))) {
        atLeastOnGlued = true
        break
      }
    }
    if (!atLeastOnGlued) {
      return
    }
    const metrolines = Array.from(poly).map((p) => this.metroGraphData.PointToStations.get(p))
    this.metroGraphData.Edges[edgeIndex].curve = Polyline.mkFromPoints(StationPositionsAdjuster.GluedPolyline(metrolines, gluingMap))
    return
  }
  static GluedPolyline(metroline: Station[], gluedMap: Map<Station, Station>): Array<Point> {
    let i: number
    const ret = new Stack<Station>()
    ret.push(metroline[0])
    const seenStations = new Set<Station>()
    for (i = 1; i < metroline.length - 1; i++) {
      const station = StationPositionsAdjuster.Glued(metroline[i], gluedMap)
      if (seenStations.has(station)) {
        // we made a cycle - need to cut it out
        while (ret.top !== station) {
          seenStations.delete(ret.pop())
        }

        continue
      }

      if (Point.closeDistEps(station.Position, ret.top.Position)) {
        continue
      }

      seenStations.add(station)
      ret.push(station)
    }

    ret.push(metroline[i])
    return Array.from(ret)
      .reverse()
      .map((n) => n.Position)
  }

  static Glued(i: Station, gluedMap: Map<Station, Station>): Station {
    return gluedMap.get(i) ?? i
  }

  ink: number

  polylineLength: Map<Metroline, number>

  // Unbundle unnecessary edges:
  //  instead of one bundle (a->bcd) we get two bundles (a->b,a->cd) with smaller ink
  UnglueEdgesFromBundleToSaveInk(alwaysExecuteSA: boolean): boolean {
    const segsToPolylines = new PointPairMap<Set<Metroline>>()
    this.ink = this.metroGraphData.Ink
    this.polylineLength = new Map<Metroline, number>()
    // create polylines
    for (const metroline of this.metroGraphData.Metrolines) {
      this.polylineLength.set(metroline, metroline.Length)
      for (let pp = metroline.Polyline.startPoint; pp.next != null; pp = pp.next) {
        const segment = new PointPair(pp.point, pp.next.point)
        addToPointPairMap(segsToPolylines, segment, metroline)
      }
    }
    const affectedPoints = new PointSet()
    let progress = false
    for (const metroline of this.metroGraphData.Metrolines) {
      const obstaclesAllowedToIntersect = setIntersection(
        this.metroGraphData.PointToStations.get(metroline.Polyline.start).getELP(),
        this.metroGraphData.PointToStations.get(metroline.Polyline.end).getELP(),
      )
      if (this.TrySeparateOnPolyline(metroline, segsToPolylines, affectedPoints, obstaclesAllowedToIntersect)) progress = true
    }

    if (progress)
      //TimeMeasurer.DebugOutput("unbundling");
      this.metroGraphData.Initialize(false)

    if (alwaysExecuteSA || progress) {
      SimulatedAnnealing.FixRoutingMBP(this.metroGraphData, this.bundlingSettings, alwaysExecuteSA ? null : affectedPoints)
    }

    return progress
  }

  TrySeparateOnPolyline(
    metroline: Metroline,
    segsToPolylines: PointPairMap<Set<Metroline>>,
    affectedPoints: PointSet,
    obstaclesAllowedToIntersect: Set<Polyline>,
  ): boolean {
    let progress = false
    let relaxing = true
    while (relaxing) {
      relaxing = false
      for (let p = metroline.Polyline.startPoint; p.next != null && p.next.next != null; p = p.next) {
        if (this.TryShortcutPolypoint(p, segsToPolylines, affectedPoints, obstaclesAllowedToIntersect)) {
          relaxing = true
        }
      }

      if (relaxing) {
        progress = true
      }
    }

    return progress
  }

  TryShortcutPolypoint(
    pp: PolylinePoint,
    segsToPolylines: PointPairMap<Set<Metroline>>,
    affectedPoints: PointSet,
    obstaclesAllowedToIntersect: Set<Polyline>,
  ): boolean {
    if (this.SeparationShortcutAllowed(pp, segsToPolylines, obstaclesAllowedToIntersect)) {
      affectedPoints.add(pp.point)
      affectedPoints.add(pp.next.point)
      affectedPoints.add(pp.next.next.point)
      this.RemoveShortcuttedPolypoint(pp, segsToPolylines)
      return true
    }

    return false
  }

  // allowed iff line (a,c) is legal and inkgain > 0
  SeparationShortcutAllowed(
    pp: PolylinePoint,
    segsToPolylines: PointPairMap<Set<Metroline>>,
    obstaclesAllowedToIntersect: Set<Polyline>,
  ): boolean {
    const a = pp.point
    const b = pp.next.point
    const c = pp.next.next.point
    const aStation = this.metroGraphData.PointToStations.get(a)
    const bStation = this.metroGraphData.PointToStations.get(b)
    const cStation = this.metroGraphData.PointToStations.get(c)
    // 1. intersections
    const aUc = uniteSets(aStation.getELP(), cStation.getELP())
    const obstaclesToIgnore = setIntersectionOfArray([obstaclesAllowedToIntersect, bStation.getELP(), aUc])

    if (!this.metroGraphData.cdtIntersections.EdgeIsLegalSSPPS(aStation, cStation, obstaclesToIgnore)) {
      return false
    }

    // 2. cost gain
    const inkgain = this.GetInkgain(pp, segsToPolylines, a, b, c)
    if (inkgain < 0) {
      return false
    }

    return true
  }

  GetInkgain(pp: PolylinePoint, segsToPolylines: PointPairMap<Set<Metroline>>, a: Point, b: Point, c: Point): number {
    //const abPolylines:Set<Metroline>, bcPolylines:Set<Metroline>, abcPolylines:Set<Metroline>;
    const [abPolylines, bcPolylines, abcPolylines] = this.FindPolylines(pp, segsToPolylines)
    let gain = 0
    //ink
    const oldInk = this.ink
    let newInk = this.ink
    const ab = a.sub(b).length
    const bc = b.sub(c).length
    const ac = a.sub(c).length
    if (abPolylines.size === abcPolylines.size) newInk -= ab
    if (bcPolylines.size === abcPolylines.size) newInk -= bc
    const t = segsToPolylines.get(new PointPair(a, c))
    if (!t || t.size === 0) newInk += ac
    gain += CostCalculator.InkError(oldInk, newInk, this.bundlingSettings)

    //path lengths
    for (const metroline of abcPolylines) {
      const oldLength = this.polylineLength.get(metroline)
      const newLength = oldLength - (ab + bc - ac)

      gain += CostCalculator.PathLengthsError(oldLength, newLength, metroline.IdealLength, this.bundlingSettings)
    }

    //radii
    let nowR = this.GetCurrentHubRadius(this.metroGraphData.PointToStations.get(a))
    const widthABC = this.metroGraphData.GetWidthAN(Array.from(abcPolylines), this.bundlingSettings.EdgeSeparation)
    const widthABD = this.metroGraphData.GetWidthAN(
      Array.from(substractSets(abPolylines, abcPolylines)),
      this.bundlingSettings.EdgeSeparation,
    )
    let idealR = HubRadiiCalculator.GetMinRadiusForTwoAdjacentBundlesNPPPNNB(nowR, a, c, b, widthABC, widthABD, this.bundlingSettings)
    if (idealR > nowR) {
      gain -= CostCalculator.RError(idealR, nowR, this.bundlingSettings)
    }

    //check opposite side
    nowR = this.GetCurrentHubRadius(this.metroGraphData.PointToStations.get(c))
    const widthCBD = this.metroGraphData.GetWidthAN(
      Array.from(substractSets(bcPolylines, abcPolylines)),
      this.bundlingSettings.EdgeSeparation,
    )
    idealR = HubRadiiCalculator.GetMinRadiusForTwoAdjacentBundlesNPPPNNB(nowR, c, b, a, widthCBD, widthABC, this.bundlingSettings)
    if (idealR > nowR) {
      gain -= CostCalculator.RError(idealR, nowR, this.bundlingSettings)
    }

    return gain
  }

  RemoveShortcuttedPolypoint(pp: PolylinePoint, segsToPolylines: PointPairMap<Set<Metroline>>) {
    const a = pp.point
    const b = pp.next.point
    const c = pp.next.next.point

    const [abPolylines, bcPolylines, abcPolylines] = this.FindPolylines(pp, segsToPolylines)

    const ab = distPP(a, b)
    const bc = distPP(b, c)
    const ac = distPP(a, c)

    //fixing ink
    if (abPolylines.size === abcPolylines.size) this.ink -= ab
    if (bcPolylines.size === abcPolylines.size) this.ink -= bc
    const t = segsToPolylines.get(new PointPair(a, c))
    if (!t || t.size === 0) this.ink += ac

    //fixing edge lengths
    for (const metroline of abcPolylines) {
      const l = this.polylineLength.get(metroline)
      this.polylineLength.set(metroline, l - (ab + bc - ac))
    }

    //fixing polylines
    for (const metroline of abcPolylines) {
      const pp = Array.from(metroline.Polyline.polylinePoints()).find((p) => p.point.equal(b))
      this.RemovePolypoint(pp)
      removeFromPointPairMapTuple(segsToPolylines, [a, b], metroline)
      removeFromPointPairMapTuple(segsToPolylines, [b, c], metroline)
      addToPointMapTuple(segsToPolylines, [a, c], metroline)
    }
  }

  FindPolylines(pp: PolylinePoint, segsToPolylines: PointPairMap<Set<Metroline>>): [Set<Metroline>, Set<Metroline>, Set<Metroline>] {
    const a: Point = pp.point
    const b: Point = pp.next.point
    const c: Point = pp.next.next.point
    const abPolylines = segsToPolylines.getPP(a, b)
    const bcPolylines = segsToPolylines.getPP(b, c)
    const abcPolylines = setIntersection(abPolylines, bcPolylines)
    return [abPolylines, bcPolylines, abcPolylines]
  }

  RemovePolypoint(p: PolylinePoint) {
    const prev: PolylinePoint = p.prev
    const next: PolylinePoint = p.next
    prev.next = next
    next.prev = prev
  }

  /**   Fix the situation where a station has two neighbors that are almost in the same directions */
  GlueCollinearNeighbors(step: number): boolean {
    const affectedPoints: PointSet = new PointSet()
    let progress = false
    for (const node of this.metroGraphData.Stations)
      if (this.GlueCollinearNeighborsSPN(node, affectedPoints, step)) {
        progress = true
      }

    if (progress) {
      // TimeMeasurer.DebugOutput("gluing edges");
      this.metroGraphData.Initialize(false)
      SimulatedAnnealing.FixRoutingMBP(this.metroGraphData, this.bundlingSettings, affectedPoints)
    }

    return progress
  }

  GlueCollinearNeighborsSPN(node: Station, affectedPoints: PointSet, step: number): boolean {
    if (node.Neighbors.length <= 1) {
      return false
    }

    // node,adj => new via point
    const gluedEdges: TupleMap<Station, Station, Point> = new TupleMap<Station, Station, Point>()
    const neighbors = node.Neighbors
    for (let i = 0; i < neighbors.length; i++) {
      this.TryToGlueEdges(node, neighbors[i], neighbors[(i + 1) % neighbors.length], gluedEdges, step)
    }

    if (gluedEdges.isEmpty) {
      return false
    }

    for (const keyValueTriple of gluedEdges) {
      this.GlueEdge(keyValueTriple)
      affectedPoints.add(keyValueTriple[0].Position)
      affectedPoints.add(keyValueTriple[1].Position)
      affectedPoints.add(keyValueTriple[2])
    }
    return true
  }

  TryToGlueEdges(node: Station, a: Station, b: Station, gluedEdges: TupleMap<Station, Station, Point>, step: number) {
    //Assert.assert(a !== b)
    const angle = Point.anglePCP(a.Position, node.Position, b.Position)
    if (angle < this.bundlingSettings.AngleThreshold) {
      const la = distPP(a.Position, node.Position)
      const lb = distPP(b.Position, node.Position)
      const ratio: number = Math.min(la, lb) / Math.max(la, lb)
      if (ratio < 0.05) {
        return
      }

      if (la < lb) {
        if (this.EdgeGluingIsAllowedSSS(node, a, b)) {
          this.AddEdgeToGlue(node, b, a, a.Position, gluedEdges)
          return
        }
      } else if (this.EdgeGluingIsAllowedSSS(node, b, a)) {
        this.AddEdgeToGlue(node, a, b, b.Position, gluedEdges)
        return
      }

      // TODO: need this???
      if (step < 5 && ratio > 0.5) {
        const newPosition: Point = this.ConstructGluingPoint(node, a, b)
        if (this.EdgeGluingIsAllowedSSSP(node, a, b, newPosition)) {
          this.AddEdgeToGlue(node, b, a, newPosition, gluedEdges)
        }
      }
    }
  }

  ConstructGluingPoint(node: Station, a: Station, b: Station): Point {
    // temp
    const len: number = Math.min(distPP(a.Position, node.Position), distPP(b.Position, node.Position) / 2)
    const dir: Point = a.Position.sub(node.Position).normalize().add(b.Position.sub(node.Position).normalize())
    return node.Position.add(dir.mul(len / 2))
  }

  EdgeGluingIsAllowedSSS(node: Station, a: Station, b: Station): boolean {
    // 0. can't pass through real nodes
    if (a.IsReal || b.IsReal) {
      return false
    }

    // 0.5 do not glue the stations with the different passports
    if (!setsAreEqual(a.getELP(), b.getELP())) {
      return false
    }

    // 1. check intersections)  Here we are bending the edge (node->b) to pass through a.Position.
    // We need to be sure that segments (node,a) and (a,b) intersect only obstacles enterable for the bundle (node, b)
    if (!this.metroGraphData.cdtIntersections.EdgeIsLegal(a, b, a.Position, b.Position)) {
      return false
    }

    const enterableForEdgeNodeB = this.metroGraphData.looseIntersections.ObstaclesToIgnoreForBundle(node, b)
    const crossingsOfEdgeNodeA = InteractiveEdgeRouter.IntersectionsOfLineAndRectangleNodeOverPolylineLR(
      LineSegment.mkPP(node.Position, a.Position),
      this.metroGraphData.LooseTree,
    )
    if (crossingsOfEdgeNodeA.find((ii) => !enterableForEdgeNodeB.has(<Polyline>ii.seg1))) {
      return false
    }

    const crossingsOfEdgeab = InteractiveEdgeRouter.IntersectionsOfLineAndRectangleNodeOverPolylineLR(
      LineSegment.mkPP(a.Position, b.Position),
      this.metroGraphData.LooseTree,
    )
    if (crossingsOfEdgeab.find((ii) => !enterableForEdgeNodeB.has(<Polyline>ii.seg1))) {
      return false
    }

    // 2. check cost
    const delta: number = this.ComputeCostDeltaAfterEdgeGluing(node, a, b, a.Position)
    if (delta < 0) {
      return false
    }

    return true
  }

  EdgeGluingIsAllowedSSSP(node: Station, a: Station, b: Station, gluingPoint: Point): boolean {
    // 0. can't pass through real nodes
    if (!this.metroGraphData.looseIntersections.HubAvoidsObstaclesPNS__(gluingPoint, 0, setIntersection(a.getELP(), b.getELP()))) {
      return false
    }

    // 1. check intersections
    if (!this.metroGraphData.cdtIntersections.EdgeIsLegal(node, null, node.Position, gluingPoint)) {
      return false
    }

    if (!this.metroGraphData.cdtIntersections.EdgeIsLegal(a, null, a.Position, gluingPoint)) {
      return false
    }

    if (!this.metroGraphData.cdtIntersections.EdgeIsLegal(b, null, b.Position, gluingPoint)) {
      return false
    }

    // 2. check cost
    const delta: number = this.ComputeCostDeltaAfterEdgeGluing(node, a, b, gluingPoint)
    if (delta < 0) {
      return false
    }

    return true
  }

  ComputeCostDeltaAfterEdgeGluing(node: Station, a: Station, b: Station, newp: Point): number {
    let gain = 0

    //ink
    const oldInk = this.metroGraphData.Ink
    const newInk =
      this.metroGraphData.Ink -
      distPP(node.Position, b.Position) -
      distPP(node.Position, a.Position) +
      distPP(node.Position, newp) +
      distPP(newp, a.Position) +
      distPP(newp, b.Position)
    gain += CostCalculator.InkError(oldInk, newInk, this.bundlingSettings)

    //path lengths
    for (const metroline of this.metroGraphData.GetIjInfo(node, b).Metrolines) {
      const oldLength = metroline.Length
      const newLength = metroline.Length - distPP(node.Position, b.Position) + distPP(node.Position, newp) + distPP(newp, b.Position)
      gain += CostCalculator.PathLengthsError(oldLength, newLength, metroline.IdealLength, this.bundlingSettings)
    }
    for (const metroline of this.metroGraphData.GetIjInfo(node, a).Metrolines) {
      const oldLength = metroline.Length
      const newLength = metroline.Length - distPP(node.Position, a.Position) + distPP(node.Position, newp) + distPP(newp, a.Position)
      gain += CostCalculator.PathLengthsError(oldLength, newLength, metroline.IdealLength, this.bundlingSettings)
    }

    //also compute radii gain
    //let nowR = Math.Min(GetCurrentHubRadius(node), (node.Position - newp).Length);
    //let id2 = HubRadiiCalculator.CalculateIdealHubRadiusWithNeighbors(metroGraphData, bundlingSettings, node);
    const id2 = node.cachedIdealRadius
    const nowR = this.GetCurrentHubRadius(node)
    const idealR = HubRadiiCalculator.GetMinRadiusForTwoAdjacentBundles(
      nowR,
      node,
      node.Position,
      a,
      b,
      this.metroGraphData,
      this.bundlingSettings,
    )

    if (idealR > nowR) {
      gain += CostCalculator.RError(idealR, nowR, this.bundlingSettings)
    }

    if (id2 > distPP(node.Position, newp) && !node.IsReal) {
      gain -= CostCalculator.RError(id2, distPP(node.Position, newp), this.bundlingSettings)
    }

    return gain
  }

  AddEdgeToGlue(node: Station, b: Station, a: Station, newp: Point, gluedEdges: TupleMap<Station, Station, Point>) {
    // same edge in the reverse direction
    if (gluedEdges.has(a, node)) {
      return
    }

    if (gluedEdges.has(b, node)) {
      return
    }

    if (gluedEdges.has(node, a)) {
      return
    }

    if (gluedEdges.has(node, b)) {
      return
    }

    gluedEdges.set(node, a, newp)
    gluedEdges.set(node, b, newp)
  }

  GlueEdge(keyValuePair: [Station, Station, Point]) {
    const node = keyValuePair[0]
    const a = keyValuePair[1]
    const newp = keyValuePair[2]
    for (const polylinePoint of node.MetroNodeInfos.map((i) => i.PolyPoint)) {
      if (polylinePoint.next != null && polylinePoint.next.point.equal(a.Position)) {
        this.SplitPolylinePoint(polylinePoint, newp)
      } else if (polylinePoint.prev != null && polylinePoint.prev.point.equal(a.Position)) {
        this.SplitPolylinePoint(polylinePoint.prev, newp)
      }
    }
  }

  SplitPolylinePoint(node: PolylinePoint, pointToInsert: Point) {
    if (node.point === pointToInsert || node.next.point === pointToInsert) {
      return
    }

    const p = PolylinePoint.mkFromPoint(pointToInsert)
    p.polyline = node.polyline
    p.next = node.next
    p.prev = node
    p.next.prev = p
    p.prev.next = p
  }

  // split each edge that is too much constrained by the obstacles
  RelaxConstrainedEdges(): boolean {
    const affectedPoints: PointSet = new PointSet()
    let progress = false
    for (const edge of this.metroGraphData.VirtualEdges()) if (this.RelaxConstrainedEdge(edge[0], edge[1], affectedPoints)) progress = true

    if (progress) {
      //TimeMeasurer.DebugOutput("relaxing constrained edges");
      this.metroGraphData.Initialize(false)

      SimulatedAnnealing.FixRoutingMBP(this.metroGraphData, this.bundlingSettings, affectedPoints)
    }

    return progress
  }

  RelaxConstrainedEdge(a: Station, b: Station, affectedPoints: PointSet): boolean {
    //find conflicting obstacles
    const idealWidth = this.metroGraphData.GetWidthSSN(a, b, this.bundlingSettings.EdgeSeparation)
    const t = {closestDist: new Array<[Point, Point]>()}

    this.metroGraphData.cdtIntersections.BundleAvoidsObstacles(a, b, a.Position, b.Position, (0.99 * idealWidth) / 2.0, t)
    // //Assert.assert(res); //todo still unsolved
    const closestPoints = t.closestDist
    if (closestPoints.length > 0) {
      //find closest obstacle
      let bestDist = -1
      let bestPoint: Point
      for (const d of closestPoints) {
        //should not be too close
        const distToSegmentEnd = Math.min(distPP(a.Position, d[1]), distPP(b.Position, d[1]))
        const distAB = distPP(a.Position, b.Position)
        const ratio = distToSegmentEnd / distAB
        if (ratio < 0.1) continue

        //choose the closest
        const dist = distPP(d[0], d[1])
        if (bestDist === -1 || dist < bestDist) {
          bestDist = dist
          bestPoint = d[1]
        }
      }
      if (bestDist === -1) return false

      if (!this.metroGraphData.looseIntersections.HubAvoidsObstaclesPNS__(bestPoint, 0, setIntersection(a.getELP(), b.getELP())))
        return false

      affectedPoints.add(bestPoint)
      affectedPoints.add(a.Position)
      affectedPoints.add(b.Position)

      for (const metroline of this.metroGraphData.GetIjInfo(a, b).Metrolines) {
        let pp = null
        //TODO: replace the cycle!
        for (const ppp of metroline.Polyline.polylinePoints())
          if (ppp.point.equal(a.Position)) {
            pp = ppp
            break
          }

        //Assert.assert(pp != null)
        if (pp.next != null && pp.next.point.equal(b.Position)) this.SplitPolylinePoint(pp, bestPoint)
        else this.SplitPolylinePoint(pp.prev, bestPoint)
      }

      return true
    }

    return false
  }

  // switch flips

  RemoveDoublePathCrossings(): boolean {
    const progress = new PathFixer(this.metroGraphData, this.metroGraphData.PointIsAcceptableForEdge.bind(this)).run()

    if (progress) {
      this.metroGraphData.Initialize(false)
      SimulatedAnnealing.FixRouting(this.metroGraphData, this.bundlingSettings)
    }

    return progress
  }
}
