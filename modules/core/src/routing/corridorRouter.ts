/**
 * Corridor Router: routes edges directly on the CDT dual graph,
 * bypassing the cone spanner / visibility graph.
 *
 * Pipeline: CDT → BFS on dual graph → sleeve → funnel → polyline
 */
import {Point, TriangleOrientation} from '../math/geometry/point'
import {Polyline} from '../math/geometry/polyline'
import {Rectangle} from '../math/geometry/rectangle'
import {SmoothedPolyline} from '../math/geometry/smoothedPolyline'
import {HitTestBehavior} from '../math/geometry/RTree/hitTestBehavior'
import {GeomEdge} from '../layout/core/geomEdge'
import {GeomGraph} from '../layout/core/geomGraph'
import {Arrowhead} from '../layout/core/arrowhead'
import {RelativeFloatingPort} from '../layout/core/relativeFloatingPort'
import {CancelToken} from '../utils/cancelToken'
import {Cdt} from './ConstrainedDelaunayTriangulation/Cdt'
import {CdtEdge} from './ConstrainedDelaunayTriangulation/CdtEdge'
import {CdtTriangle} from './ConstrainedDelaunayTriangulation/CdtTriangle'
import {InteractiveObstacleCalculator} from './interactiveObstacleCalculator'

type Diagonal = {left: Point; right: Point}
type FrontEdge = {source: CdtTriangle; edge: CdtEdge}
type PathPoint = {point: Point; prev?: PathPoint; next?: PathPoint}

/** Check if a triangle is entirely inside a single obstacle */
function triangleIsInsideObstacle(t: CdtTriangle, allowedPolys: Set<Polyline>): boolean {
  const o0 = t.Sites.item0.Owner as Polyline
  const o1 = t.Sites.item1.Owner as Polyline
  const o2 = t.Sites.item2.Owner as Polyline
  if (o0 == null || o1 == null || o2 == null) return false
  if (o0 !== o1 || o0 !== o2) return false
  // all three sites belong to the same obstacle
  return !allowedPolys.has(o0)
}

/** Find the CDT triangle containing a given point.
 *  Uses the R-tree for efficiency, with a linear scan fallback. */
export function findContainingTriangle(cdt: Cdt, point: Point): CdtTriangle | null {
  const rTree = cdt.getRectangleNodeOnTriangles()
  if (rTree) {
    const node = rTree.FirstHitNodeWithPredicate(point, (p, tri) => {
      return tri.containsPoint(p) ? HitTestBehavior.Stop : HitTestBehavior.Continue
    })
    if (node) return node.UserData
  }
  // Fallback: linear scan
  for (const t of cdt.GetTriangles()) {
    if (t.containsPoint(point)) return t
  }
  return null
}

/** Check if a constrained edge belongs to an allowed obstacle */
function isAllowedConstrainedEdge(e: CdtEdge, allowedPolys: Set<Polyline>): boolean {
  if (!e.constrained) return true // non-constrained edges are always crossable
  // A constrained edge belongs to an allowed obstacle if both its sites
  // are owned by an allowed polyline
  const ownerUpper = e.upperSite.Owner as Polyline
  const ownerLower = e.lowerSite.Owner as Polyline
  if (ownerUpper && allowedPolys.has(ownerUpper)) return true
  if (ownerLower && allowedPolys.has(ownerLower)) return true
  return false
}

/** BFS on the CDT dual graph from sourceTriangle to the triangle containing target.
 *  Returns the sleeve (sequence of FrontEdges) or null if no path is found.
 *  Skips constrained edges (unless belonging to allowed obstacles)
 *  and obstacle-interior triangles. */
function findSleeveBFS(
  sourceTriangle: CdtTriangle,
  target: Point,
  allowedPolys: Set<Polyline>,
): FrontEdge[] | null {
  const edgeMap = new Map<CdtTriangle, CdtEdge | undefined>()
  edgeMap.set(sourceTriangle, undefined)
  const queue: CdtTriangle[] = [sourceTriangle]
  let head = 0

  while (head < queue.length) {
    const t = queue[head++]
    if (t.containsPoint(target)) {
      return recoverSleeve(sourceTriangle, edgeMap, t)
    }

    const edgeIntoT = edgeMap.get(t)
    for (const e of t.Edges) {
      if (!isAllowedConstrainedEdge(e, allowedPolys)) continue
      if (edgeIntoT !== undefined && e === edgeIntoT) continue
      const ot = e.GetOtherTriangle_T(t)
      if (ot == null) continue
      if (edgeMap.has(ot)) continue
      if (triangleIsInsideObstacle(ot, allowedPolys)) continue

      edgeMap.set(ot, e)
      queue.push(ot)
    }
  }
  return null
}

/** Recover the sleeve by tracing back from the target triangle to the source. */
function recoverSleeve(
  sourceTriangle: CdtTriangle,
  edgeMap: Map<CdtTriangle, CdtEdge | undefined>,
  targetTriangle: CdtTriangle,
): FrontEdge[] {
  const ret: FrontEdge[] = []
  for (let tr = targetTriangle; tr !== sourceTriangle; ) {
    const e = edgeMap.get(tr)
    tr = e.GetOtherTriangle_T(tr)
    ret.push({source: tr, edge: e})
  }
  return ret.reverse()
}

/** Convert a sleeve into diagonals for the funnel algorithm.
 *  Each diagonal is the shared edge between consecutive triangles,
 *  with left/right determined by the orientation relative to the
 *  opposite site in the source triangle. */
function sleeveToDiagonals(sleeve: FrontEdge[]): Diagonal[] {
  const diagonals: Diagonal[] = []
  for (const fe of sleeve) {
    const e = fe.edge
    const oppSite = fe.source.OppositeSite(e)
    if (
      Point.getTriangleOrientation(oppSite.point, e.lowerSite.point, e.upperSite.point) ===
      TriangleOrientation.Counterclockwise
    ) {
      diagonals.push({left: e.upperSite.point, right: e.lowerSite.point})
    } else {
      diagonals.push({right: e.upperSite.point, left: e.lowerSite.point})
    }
  }
  return diagonals
}

/** Funnel algorithm: find the shortest path through a sequence of diagonals.
 *  Following https://page.mi.fu-berlin.de/mulzer/notes/alggeo/polySP.pdf */
function funnelFromDiagonals(source: Point, target: Point, diagonals: Diagonal[]): Point[] {
  if (diagonals.length === 0) {
    return [source, target]
  }

  const prefix: Point[] = []
  let v = source
  const leftChainStart: PathPoint = {point: v}
  const rightChainStart: PathPoint = {point: v}
  let leftChainEnd: PathPoint = {point: diagonals[0].left, prev: leftChainStart}
  let rightChainEnd: PathPoint = {point: diagonals[0].right, prev: rightChainStart}
  leftChainStart.next = leftChainEnd
  rightChainStart.next = rightChainEnd

  let z: Point

  // Process diagonals 1..n-1
  for (let i = 1; i < diagonals.length; i++) {
    processDiagonal(i)
  }
  // Process the final step to the target
  const finalDiag: Diagonal[] = [...diagonals, {right: target, left: leftChainEnd.point}]
  processDiagonal(finalDiag.length - 1)

  // Collect the path
  const result = [...prefix]
  for (let p: PathPoint | undefined = rightChainStart; p != null; p = p.next) {
    result.push(p.point)
  }
  return result

  function processDiagonal(i: number) {
    const d = i < diagonals.length ? diagonals : finalDiag
    const leftStep = d[i - 1].left !== d[i].left

    if (leftStep) {
      z = d[i].left
      let p = leftChainEnd
      for (; !(isApex(p) || reflexLeft(p)); p = p.prev) {
        // step back on left chain
      }
      if (isApex(p)) {
        walkForwardOnRight()
      } else {
        extendLeftChain(p)
      }
    } else {
      z = d[i].right
      let p = rightChainEnd
      for (; !(isApex(p) || reflexRight(p)); p = p.prev) {
        // step back on right chain
      }
      if (isApex(p)) {
        walkForwardOnLeft()
      } else {
        extendRightChain(p)
      }
    }
  }

  function visibleRight(pp: PathPoint) {
    return pp.next == null || Point.pointToTheLeftOfLineOrOnLine(z, pp.point, pp.next.point)
  }
  function visibleLeft(pp: PathPoint) {
    return pp.next == null || Point.pointToTheRightOfLineOrOnLine(z, pp.point, pp.next.point)
  }
  function reflexLeft(pp: PathPoint): boolean {
    return Point.pointToTheLeftOfLine(z, pp.prev.point, pp.point)
  }
  function reflexRight(pp: PathPoint): boolean {
    return Point.pointToTheRightOfLine(z, pp.prev.point, pp.point)
  }

  function walkForwardOnRight() {
    let p = rightChainStart
    while (!visibleRight(p)) {
      p = p.next
    }
    if (!isApex(p)) {
      let r = rightChainStart
      for (; !r.point.equal(p.point); r = r.next) {
        prefix.push(r.point)
      }
      rightChainStart.point = r.point
      rightChainStart.next = r.next
      v = r.point
      if (rightChainEnd.point.equal(rightChainStart.point)) {
        rightChainEnd.prev = rightChainEnd.next = null
      }
    }
    leftChainStart.point = v
    leftChainEnd.point = z
    leftChainEnd.prev = leftChainStart
    leftChainStart.next = leftChainEnd
  }

  function walkForwardOnLeft() {
    let p = leftChainStart
    while (!visibleLeft(p)) {
      p = p.next
    }
    if (!isApex(p)) {
      let r = leftChainStart
      for (; !r.point.equal(p.point); r = r.next) {
        prefix.push(r.point)
      }
      leftChainStart.point = r.point
      leftChainStart.next = r.next
      v = r.point
      if (leftChainEnd.point.equal(leftChainStart.point)) {
        leftChainEnd.prev = leftChainStart.next = null
      }
    }
    rightChainStart.point = v
    rightChainEnd.point = z
    rightChainEnd.prev = rightChainStart
    rightChainStart.next = rightChainEnd
  }

  function isApex(pp: PathPoint) {
    return pp.point === v
  }

  function extendRightChain(p: PathPoint) {
    if (p !== rightChainEnd) {
      rightChainEnd.point = z
      rightChainEnd.prev = p
      p.next = rightChainEnd
    } else {
      rightChainEnd = {point: z, prev: p}
      p.next = rightChainEnd
    }
  }

  function extendLeftChain(p: PathPoint) {
    if (p !== leftChainEnd) {
      leftChainEnd.point = z
      leftChainEnd.prev = p
      p.next = leftChainEnd
    } else {
      leftChainEnd = {point: z, prev: p}
      p.next = leftChainEnd
    }
  }
}

/** Route a single edge through the CDT using the corridor approach.
 *  @param cdt - the Constrained Delaunay Triangulation
 *  @param source - source point
 *  @param target - target point
 *  @param sourcePoly - the obstacle polyline containing the source (may traverse)
 *  @param targetPoly - the obstacle polyline containing the target (may traverse)
 *  @returns optimized polyline, or null if no path found */
export function corridorRoute(
  cdt: Cdt,
  source: Point,
  target: Point,
  sourcePoly?: Polyline,
  targetPoly?: Polyline,
): Polyline | null {
  const sourceTriangle = findContainingTriangle(cdt, source)
  if (!sourceTriangle) return null

  const allowed = new Set<Polyline>()
  if (sourcePoly) allowed.add(sourcePoly)
  if (targetPoly) allowed.add(targetPoly)

  const sleeve = findSleeveBFS(sourceTriangle, target, allowed)
  if (sleeve == null) return null

  if (sleeve.length === 0) {
    return Polyline.mkFromPoints([source, target])
  }

  const diagonals = sleeveToDiagonals(sleeve)
  const points = funnelFromDiagonals(source, target, diagonals)
  return Polyline.mkFromPoints(points)
}

/** Route all edges using the corridor approach.
 *  Builds a CDT on padded obstacle polylines and routes each edge
 *  through the CDT dual graph with funnel optimization. */
export function routeCorridorEdges(geomGraph: GeomGraph, edgesToRoute: GeomEdge[], cancelToken: CancelToken, padding = 2): void {
  if (!edgesToRoute || edgesToRoute.length === 0) return

  // ensure ports exist
  for (const edge of edgesToRoute) {
    if (edge.sourcePort == null) {
      const ed = edge
      new RelativeFloatingPort(
        () => ed.source.boundaryCurve,
        () => ed.source.center,
        new Point(0, 0),
      )
    }
    if (edge.targetPort == null) {
      const ed = edge
      new RelativeFloatingPort(
        () => ed.target.boundaryCurve,
        () => ed.target.center,
        new Point(0, 0),
      )
    }
  }

  // build padded obstacle polylines from graph nodes
  const nodeToPolyline = new Map<unknown, Polyline>()
  const obstacles: Polyline[] = []
  const bb = Rectangle.mkEmpty()
  for (const node of geomGraph.nodesBreadthFirst) {
    if (cancelToken && cancelToken.canceled) return
    if (node.boundaryCurve == null) continue
    const poly = InteractiveObstacleCalculator.PaddedPolylineBoundaryOfNode(node.boundaryCurve, padding)
    nodeToPolyline.set(node, poly)
    obstacles.push(poly)
    bb.addRecSelf(poly.boundingBox)
  }

  // add bounding box so CDT covers the whole area
  bb.pad(Math.max(bb.diagonal / 4, 100))
  obstacles.push(bb.perimeter())

  // build CDT
  console.time('CorridorRouter CDT')
  const ports: Point[] = []
  for (const edge of edgesToRoute) {
    ports.push(edge.sourcePort.Location)
    ports.push(edge.targetPort.Location)
  }
  const cdt = new Cdt(ports, obstacles, [])
  cdt.run()
  console.timeEnd('CorridorRouter CDT')

  // route each edge
  console.time('CorridorRouter routing')
  for (const edge of edgesToRoute) {
    if (cancelToken && cancelToken.canceled) return

    const source = edge.sourcePort.Location
    const target = edge.targetPort.Location
    const sourcePoly = nodeToPolyline.get(edge.source)
    const targetPoly = nodeToPolyline.get(edge.target)

    const poly = corridorRoute(cdt, source, target, sourcePoly, targetPoly)
    if (poly && poly.count >= 2) {
      const smoothed = SmoothedPolyline.mkFromPoints(poly)
      edge.curve = smoothed.createCurve()
      edge.smoothedPolyline = smoothed
      Arrowhead.trimSplineAndCalculateArrowheadsII(
        edge,
        edge.source.boundaryCurve,
        edge.target.boundaryCurve,
        edge.curve,
        false,
      )
    }
  }
  console.timeEnd('CorridorRouter routing')
}
