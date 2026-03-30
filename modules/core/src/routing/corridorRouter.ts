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
import {GeomNode} from '../layout/core/geomNode'
import {GeomGraph} from '../layout/core/geomGraph'
import {Arrowhead} from '../layout/core/arrowhead'
import {RelativeFloatingPort} from '../layout/core/relativeFloatingPort'
import {CancelToken} from '../utils/cancelToken'
import {Cdt} from './ConstrainedDelaunayTriangulation/Cdt'
import {CdtEdge} from './ConstrainedDelaunayTriangulation/CdtEdge'
import {CdtSite} from './ConstrainedDelaunayTriangulation/CdtSite'
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

/** Centroid of a CDT triangle */
function triangleCentroid(t: CdtTriangle): Point {
  const a = t.Sites.item0.point
  const b = t.Sites.item1.point
  const c = t.Sites.item2.point
  return new Point((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3)
}

/** Check if we can cross this edge.
 *  Non-constrained edges are always crossable.
 *  Constrained edges are crossable as long as we don't enter an
 *  obstacle interior — that check happens via triangleIsInsideObstacle. */
function canCrossEdge(e: CdtEdge, _allowedPolys: Set<Polyline>): boolean {
  // The obstacle-interior check on the neighbor triangle (triangleIsInsideObstacle)
  // is sufficient to prevent entering obstacles. Blocking constrained edge
  // crossings here is too restrictive — it prevents routing through free-space
  // channels between touching obstacles.
  return true
}

/** Dijkstra shortest-path tree on the CDT dual graph from a source triangle.
 *  Explores until all target triangles are found (or the whole reachable
 *  graph is explored). Returns the parent-edge map for sleeve recovery. */
function dijkstraTree(
  sourceTriangle: CdtTriangle,
  targetTriangles: Set<CdtTriangle>,
  allowedPolys: Set<Polyline>,
): Map<CdtTriangle, CdtEdge | undefined> {
  const gScore = new Map<CdtTriangle, number>()
  const cameFromEdge = new Map<CdtTriangle, CdtEdge | undefined>()

  const open: {g: number; t: CdtTriangle; seq: number}[] = []
  let seqCounter = 0
  let remaining = targetTriangles.size

  function heapPush(item: {g: number; t: CdtTriangle; seq: number}) {
    open.push(item)
    let i = open.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (open[parent].g < item.g || (open[parent].g === item.g && open[parent].seq < item.seq)) break
      open[i] = open[parent]
      open[parent] = item
      i = parent
    }
  }

  function heapPop(): {g: number; t: CdtTriangle; seq: number} {
    const top = open[0]
    const last = open.pop()
    if (open.length > 0) {
      open[0] = last
      let i = 0
      while (true) {
        let smallest = i
        const l = 2 * i + 1
        const r = 2 * i + 2
        if (l < open.length && (open[l].g < open[smallest].g || (open[l].g === open[smallest].g && open[l].seq < open[smallest].seq)))
          smallest = l
        if (r < open.length && (open[r].g < open[smallest].g || (open[r].g === open[smallest].g && open[r].seq < open[smallest].seq)))
          smallest = r
        if (smallest === i) break
        const tmp = open[i]
        open[i] = open[smallest]
        open[smallest] = tmp
        i = smallest
      }
    }
    return top
  }

  gScore.set(sourceTriangle, 0)
  cameFromEdge.set(sourceTriangle, undefined)
  heapPush({g: 0, t: sourceTriangle, seq: seqCounter++})

  const foundTargets = new Set<CdtTriangle>()

  while (open.length > 0 && remaining > 0) {
    const current = heapPop()
    const t = current.t

    if (current.g > (gScore.get(t) ?? Infinity)) continue

    if (targetTriangles.has(t) && !foundTargets.has(t)) {
      foundTargets.add(t)
      remaining--
      if (remaining === 0) break
    }

    const tCentroid = triangleCentroid(t)
    const edgeIntoT = cameFromEdge.get(t)

    for (const e of t.Edges) {
      if (edgeIntoT !== undefined && e === edgeIntoT) continue
      const ot = e.GetOtherTriangle_T(t)
      if (ot == null) continue
      if (triangleIsInsideObstacle(ot, allowedPolys)) {
        // Allow reaching target triangles but don't expand through them
        if (targetTriangles.has(ot) && !foundTargets.has(ot)) {
          const otCentroid = triangleCentroid(ot)
          const edgeCost = tCentroid.sub(otCentroid).length
          const tentativeG = current.g + edgeCost
          const prevG = gScore.get(ot)
          if (prevG === undefined || tentativeG < prevG) {
            gScore.set(ot, tentativeG)
            cameFromEdge.set(ot, e)
            // Don't push to open — this is a terminal node
            foundTargets.add(ot)
            remaining--
          }
        }
        continue
      }

      const otCentroid = triangleCentroid(ot)
      const edgeCost = tCentroid.sub(otCentroid).length
      const tentativeG = current.g + edgeCost

      const prevG = gScore.get(ot)
      if (prevG !== undefined && tentativeG >= prevG) continue

      gScore.set(ot, tentativeG)
      cameFromEdge.set(ot, e)
      heapPush({g: tentativeG, t: ot, seq: seqCounter++})
    }
  }
  return cameFromEdge
}

/** A* on the CDT dual graph from sourceTriangle to the triangle containing target.
 *  Uses Euclidean distance between triangle centroids for edge weights
 *  and straight-line distance to target as heuristic.
 *  Returns the sleeve (sequence of FrontEdges) or null if no path is found. */
function findSleeveAStar(
  sourceTriangle: CdtTriangle,
  target: Point,
  allowedPolys: Set<Polyline>,
): FrontEdge[] | null {
  // priority queue entry: [f-score, triangle, insertion-order (tiebreak)]
  const gScore = new Map<CdtTriangle, number>()
  const cameFromEdge = new Map<CdtTriangle, CdtEdge | undefined>()

  // simple binary-heap priority queue
  const open: {f: number; g: number; t: CdtTriangle; seq: number}[] = []
  let seqCounter = 0

  function heapPush(item: {f: number; g: number; t: CdtTriangle; seq: number}) {
    open.push(item)
    let i = open.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (open[parent].f < item.f || (open[parent].f === item.f && open[parent].seq < item.seq)) break
      open[i] = open[parent]
      open[parent] = item
      i = parent
    }
  }

  function heapPop(): {f: number; g: number; t: CdtTriangle; seq: number} {
    const top = open[0]
    const last = open.pop()
    if (open.length > 0) {
      open[0] = last
      let i = 0
      while (true) {
        let smallest = i
        const l = 2 * i + 1
        const r = 2 * i + 2
        if (l < open.length && (open[l].f < open[smallest].f || (open[l].f === open[smallest].f && open[l].seq < open[smallest].seq)))
          smallest = l
        if (r < open.length && (open[r].f < open[smallest].f || (open[r].f === open[smallest].f && open[r].seq < open[smallest].seq)))
          smallest = r
        if (smallest === i) break
        const tmp = open[i]
        open[i] = open[smallest]
        open[smallest] = tmp
        i = smallest
      }
    }
    return top
  }

  const sourceCentroid = triangleCentroid(sourceTriangle)
  const h0 = sourceCentroid.sub(target).length
  gScore.set(sourceTriangle, 0)
  cameFromEdge.set(sourceTriangle, undefined)
  heapPush({f: h0, g: 0, t: sourceTriangle, seq: seqCounter++})

  while (open.length > 0) {
    const current = heapPop()
    const t = current.t

    // stale entry?
    if (current.g > (gScore.get(t) ?? Infinity)) continue

    if (t.containsPoint(target)) {
      return recoverSleeve(sourceTriangle, cameFromEdge, t)
    }

    const tCentroid = triangleCentroid(t)
    const edgeIntoT = cameFromEdge.get(t)

    for (const e of t.Edges) {
      if (!canCrossEdge(e, allowedPolys)) continue
      if (edgeIntoT !== undefined && e === edgeIntoT) continue
      const ot = e.GetOtherTriangle_T(t)
      if (ot == null) continue
      // Allow entering an obstacle triangle if it contains the target
      if (triangleIsInsideObstacle(ot, allowedPolys) && !ot.containsPoint(target)) continue

      const otCentroid = triangleCentroid(ot)
      const edgeCost = tCentroid.sub(otCentroid).length
      const tentativeG = current.g + edgeCost

      const prevG = gScore.get(ot)
      if (prevG !== undefined && tentativeG >= prevG) continue

      gScore.set(ot, tentativeG)
      cameFromEdge.set(ot, e)
      const h = otCentroid.sub(target).length
      heapPush({f: tentativeG + h, g: tentativeG, t: ot, seq: seqCounter++})
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

/** Compute the maximum t ∈ [0,1] such that moving vertex v to v+t*(s-v)
 *  does not flip the orientation of any triangle using v.
 *  Each triangle is given as the other two vertices (a, b) — the triangle
 *  is (v, a, b) and must maintain its original signed-area sign. */
function legalCollapseT(v: Point, s: Point, triangles: {a: Point; b: Point}[]): number {
  let tMax = 1.0
  const dir = s.sub(v)

  for (const {a, b} of triangles) {
    const edge = b.sub(a)
    const c0 = edge.x * (v.y - a.y) - edge.y * (v.x - a.x) // cross(b-a, v-a)
    const c1 = edge.x * dir.y - edge.y * dir.x // cross(b-a, s-v)

    if (c1 < -1e-12) {
      const tUpper = c0 / (-c1)
      if (tUpper < tMax) tMax = tUpper
    }
  }

  return Math.max(0, Math.min(1, tMax * 0.99)) // small safety margin
}

/** Collect all sleeve triangles (both sides of each FrontEdge). */
function collectSleeveTriangles(sleeve: FrontEdge[]): CdtTriangle[] {
  const seen = new Set<CdtTriangle>()
  const result: CdtTriangle[] = []
  for (const fe of sleeve) {
    if (!seen.has(fe.source)) {
      seen.add(fe.source)
      result.push(fe.source)
    }
    const ot = fe.edge.GetOtherTriangle_T(fe.source)
    if (ot && !seen.has(ot)) {
      seen.add(ot)
      result.push(ot)
    }
  }
  return result
}

/** Convert a sleeve into diagonals for the funnel algorithm.
 *  Moves source/target obstacle vertices toward their node center
 *  as far as CDT triangle orientations allow, to widen the channel
 *  and eliminate sharp turns near endpoints. */
function sleeveToDiagonals(
  sleeve: FrontEdge[],
  collapseSource?: {poly: Polyline; center: Point},
  collapseTarget?: {poly: Polyline; center: Point},
): Diagonal[] {
  const allTriangles = collectSleeveTriangles(sleeve)

  // Build constraint map: only use triangles where NEITHER other vertex
  // belongs to the same collapsing obstacle
  const siteConstraints = new Map<CdtSite, {a: Point; b: Point}[]>()
  for (const t of allTriangles) {
    const sites = [t.Sites.item0, t.Sites.item1, t.Sites.item2]
    for (let i = 0; i < 3; i++) {
      const s = sites[i]
      const sOther1 = sites[(i + 1) % 3]
      const sOther2 = sites[(i + 2) % 3]

      const isSourceSite = collapseSource && s.Owner === collapseSource.poly
      const isTargetSite = collapseTarget && s.Owner === collapseTarget.poly
      if (!isSourceSite && !isTargetSite) continue

      const collapsePoly = isSourceSite ? collapseSource.poly : collapseTarget.poly
      if (sOther1.Owner === collapsePoly || sOther2.Owner === collapsePoly) continue

      let list = siteConstraints.get(s)
      if (!list) { list = []; siteConstraints.set(s, list) }
      list.push({a: sOther1.point, b: sOther2.point})
    }
  }

  // Move each obstacle vertex toward center as far as constraints allow
  const sitePosition = new Map<CdtSite, Point>()
  for (const [site, tris] of siteConstraints) {
    const center = (collapseSource && site.Owner === collapseSource.poly)
      ? collapseSource.center : collapseTarget.center
    const t = legalCollapseT(site.point, center, tris)
    if (t > 0.01) {
      sitePosition.set(site, site.point.add(center.sub(site.point).mul(t)))
    }
  }
  // Also move obstacle vertices with NO free-space constraints (fully interior)
  for (const t of allTriangles) {
    for (const site of [t.Sites.item0, t.Sites.item1, t.Sites.item2]) {
      if (sitePosition.has(site) || siteConstraints.has(site)) continue
      if (collapseSource && site.Owner === collapseSource.poly) {
        sitePosition.set(site, collapseSource.center)
      } else if (collapseTarget && site.Owner === collapseTarget.poly) {
        sitePosition.set(site, collapseTarget.center)
      }
    }
  }

  function getPosition(site: CdtSite): Point {
    return sitePosition.get(site) ?? site.point
  }

  const diagonals: Diagonal[] = []
  for (const fe of sleeve) {
    const e = fe.edge
    const lowerPt = getPosition(e.lowerSite)
    const upperPt = getPosition(e.upperSite)

    if (lowerPt.sub(upperPt).length < 1e-8) continue

    // Skip same-obstacle internal edges
    if (collapseSource && e.lowerSite.Owner === collapseSource.poly && e.upperSite.Owner === collapseSource.poly) continue
    if (collapseTarget && e.lowerSite.Owner === collapseTarget.poly && e.upperSite.Owner === collapseTarget.poly) continue

    const oppSite = fe.source.OppositeSite(e)
    if (
      Point.getTriangleOrientation(oppSite.point, e.lowerSite.point, e.upperSite.point) ===
      TriangleOrientation.Counterclockwise
    ) {
      diagonals.push({left: upperPt, right: lowerPt})
    } else {
      diagonals.push({right: upperPt, left: lowerPt})
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
 *  Virtually collapses source/target obstacle boundaries to their centers
 *  in the funnel diagonals, so the funnel routes directly from/to
 *  node centers without sharp turns at obstacle corners. */
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

  const sleeve = findSleeveAStar(sourceTriangle, target, allowed)
  if (sleeve == null) return null

  if (sleeve.length === 0) {
    return Polyline.mkFromPoints([source, target])
  }

  // Collapse source/target obstacle boundaries to their centers
  const collapseSource = sourcePoly ? {poly: sourcePoly, center: source} : undefined
  const collapseTarget = targetPoly ? {poly: targetPoly, center: target} : undefined
  const diagonals = sleeveToDiagonals(sleeve, collapseSource, collapseTarget)

  if (diagonals.length === 0) {
    return Polyline.mkFromPoints([source, target])
  }

  const points = funnelFromDiagonals(source, target, diagonals)
  return Polyline.mkFromPoints(points)
}

/** Route all edges using the corridor approach.
 *  Builds a CDT on padded obstacle polylines and routes each edge
 *  through the CDT dual graph with funnel optimization. */
export function routeCorridorEdges(geomGraph: GeomGraph, edgesToRoute: GeomEdge[], cancelToken: CancelToken, padding = 2): void {
  if (!edgesToRoute || edgesToRoute.length === 0) return

  // ensure ports exist — assign them directly to edges
  for (const edge of edgesToRoute) {
    if (edge.sourcePort == null) {
      const ed = edge
      ed.sourcePort = RelativeFloatingPort.mk(
        () => ed.source.boundaryCurve,
        () => ed.source.center,
      )
    }
    if (edge.targetPort == null) {
      const ed = edge
      ed.targetPort = RelativeFloatingPort.mk(
        () => ed.target.boundaryCurve,
        () => ed.target.center,
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

  // build CDT — do NOT add port locations as isolated sites,
  // because ports inside other nodes' obstacles would break
  // the obstacle-interior check (null-owner sites create holes).
  console.time('CorridorRouter CDT')
  const cdt = new Cdt([], obstacles, [])
  cdt.run()
  console.timeEnd('CorridorRouter CDT')

  // route edges using Dijkstra tree per source node
  console.time('CorridorRouter routing')

  // Group edges by source node
  const edgesBySource = new Map<GeomNode, GeomEdge[]>()
  for (const edge of edgesToRoute) {
    if (cancelToken && cancelToken.canceled) return
    if (edge.sourcePort == null || edge.targetPort == null) continue
    let list = edgesBySource.get(edge.source)
    if (!list) { list = []; edgesBySource.set(edge.source, list) }
    list.push(edge)
  }

  for (const [sourceNode, edges] of edgesBySource) {
    if (cancelToken && cancelToken.canceled) return
    const source = sourceNode.center
    const sourcePoly = nodeToPolyline.get(sourceNode)
    const sourceTriangle = findContainingTriangle(cdt, source)
    if (!sourceTriangle) {
      // fallback: straight lines for all edges from this node
      for (const edge of edges) {
        const target = edge.target.center
        const fallback = Polyline.mkFromPoints([source, target])
        edge.curve = fallback.toCurve()
        edge.smoothedPolyline = SmoothedPolyline.mkFromPoints([source, target])
        Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false)
      }
      continue
    }

    // Find all target triangles for this source
    const targetInfos: {edge: GeomEdge; target: Point; targetPoly?: Polyline; targetTriangle: CdtTriangle}[] = []
    const targetTriangles = new Set<CdtTriangle>()
    for (const edge of edges) {
      const target = edge.target.center
      const targetPoly = nodeToPolyline.get(edge.target)
      const targetTriangle = findContainingTriangle(cdt, target)
      if (!targetTriangle) {
        // fallback for this edge
        const fallback = Polyline.mkFromPoints([source, target])
        edge.curve = fallback.toCurve()
        edge.smoothedPolyline = SmoothedPolyline.mkFromPoints([source, target])
        Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false)
        continue
      }
      targetInfos.push({edge, target, targetPoly, targetTriangle})
      targetTriangles.add(targetTriangle)
    }

    if (targetInfos.length === 0) continue

    // Dijkstra with only source poly allowed — target obstacle entry is
    // handled by the fact that canCrossEdge always returns true
    const allowed = new Set<Polyline>()
    if (sourcePoly) allowed.add(sourcePoly)

    // Single Dijkstra from sourceTriangle to all target triangles
    const parentMap = dijkstraTree(sourceTriangle, targetTriangles, allowed)

    // Extract sleeve and route each edge
    for (const {edge, target, targetPoly, targetTriangle} of targetInfos) {
      // Check if Dijkstra reached this target
      if (!parentMap.has(targetTriangle)) {
        // fallback to individual A* (target may be inside obstacle requiring allowed polys)
        const poly = corridorRoute(cdt, source, target, sourcePoly, targetPoly)
        if (poly && poly.count >= 2) {
          edge.curve = poly.toCurve()
          edge.smoothedPolyline = SmoothedPolyline.mkFromPoints(poly)
        } else {
          const fallback = Polyline.mkFromPoints([source, target])
          edge.curve = fallback.toCurve()
          edge.smoothedPolyline = SmoothedPolyline.mkFromPoints([source, target])
        }
      } else {
        const sleeve = recoverSleeve(sourceTriangle, parentMap, targetTriangle)
        if (sleeve.length === 0) {
          const pts = Polyline.mkFromPoints([source, target])
          edge.curve = pts.toCurve()
          edge.smoothedPolyline = SmoothedPolyline.mkFromPoints([source, target])
        } else {
          const collapseSource = sourcePoly ? {poly: sourcePoly, center: source} : undefined
          const collapseTarget = targetPoly ? {poly: targetPoly, center: target} : undefined
          const diagonals = sleeveToDiagonals(sleeve, collapseSource, collapseTarget)
          if (diagonals.length === 0) {
            const pts = Polyline.mkFromPoints([source, target])
            edge.curve = pts.toCurve()
            edge.smoothedPolyline = SmoothedPolyline.mkFromPoints([source, target])
          } else {
            const points = funnelFromDiagonals(source, target, diagonals)
            const poly = Polyline.mkFromPoints(points)
            edge.curve = poly.toCurve()
            edge.smoothedPolyline = SmoothedPolyline.mkFromPoints(poly)
          }
        }
      }
      Arrowhead.trimSplineAndCalculateArrowheadsII(
        edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false,
      )
    }
  }
  console.timeEnd('CorridorRouter routing')
}
