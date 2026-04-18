/**
 * Corridor Router: routes edges directly on the CDT dual graph,
 * bypassing the cone spanner / visibility graph.
 *
 * Pipeline: CDT → Dijkstra tree on dual graph → sleeve → funnel → polyline
 *
 * Contraction Hierarchies + Hub-Based Labeling (Abraham et al.,
 * MSR-TR-2010-165) are available via ContractionHierarchy and HubLabels
 * classes for individual corridor queries; the batch router uses
 * per-source Dijkstra trees for best amortized performance.
 */
import {Point, TriangleOrientation} from '../math/geometry/point'
import {Polyline} from '../math/geometry/polyline'
import {Rectangle} from '../math/geometry/rectangle'
import {SmoothedPolyline} from '../math/geometry/smoothedPolyline'
import {Curve} from '../math/geometry/curve'
import {ICurve} from '../math/geometry/icurve'
import {BezierSeg} from '../math/geometry/bezierSeg'
import {CornerSite} from '../math/geometry/cornerSite'
import {HitTestBehavior} from '../math/geometry/RTree/hitTestBehavior'
import {PlaneTransformation} from '../math/geometry/planeTransformation'
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
import {ContractionHierarchy, freeSpaceFilter} from './contractionHierarchy'
import {HubLabels} from './hubLabels'
import {ShapeCreator} from './ShapeCreator'
import {Shape} from './shape'
import {RelativeShape} from './RelativeShape'
import {
  getAncestorSetsMap,
  groupEdgesByPassport,
  getObstaclesFromPassport,
  calculatePortsToShapes,
} from './passportRouting'

export type Diagonal = {left: Point; right: Point}
type FrontEdge = {source: CdtTriangle; edge: CdtEdge}
type PathPoint = {point: Point; prev?: PathPoint; next?: PathPoint}

/** Pre-computed triangle index for fast typed-array Dijkstra/A*.
 *  Assigns integer IDs to all CDT triangles, pre-computes edge midpoints
 *  and neighbor relationships for cache-friendly access. */
export class TriangleIndex {
  readonly triToId: Map<CdtTriangle, number>
  readonly triangles: CdtTriangle[]
  readonly n: number
  // For each triangle, up to 3 neighbor IDs (−1 if none) and the CdtEdge
  readonly nbId: Int32Array // [i*3+0..i*3+2] — neighbor triangle IDs
  readonly nbEdge: (CdtEdge | null)[] // [i*3+0..i*3+2] — corresponding CDT edges
  // Edge midpoints: [i*6+j*2+0] = x, [i*6+j*2+1] = y for neighbor j of triangle i
  readonly midX: Float64Array
  readonly midY: Float64Array
  // Centroids
  readonly centX: Float64Array
  readonly centY: Float64Array
  // Obstacle owner (null if free-space)
  readonly obstacleOwner: (Polyline | null)[]

  constructor(cdt: Cdt) {
    const triToId = new Map<CdtTriangle, number>()
    const triangles: CdtTriangle[] = []
    for (const t of cdt.GetTriangles()) {
      triToId.set(t, triangles.length)
      triangles.push(t)
    }
    this.triToId = triToId
    this.triangles = triangles
    this.n = triangles.length

    const n = this.n
    this.nbId = new Int32Array(n * 3).fill(-1)
    this.nbEdge = new Array(n * 3).fill(null)
    this.midX = new Float64Array(n * 3)
    this.midY = new Float64Array(n * 3)
    this.centX = new Float64Array(n)
    this.centY = new Float64Array(n)
    this.obstacleOwner = new Array(n)

    for (let i = 0; i < n; i++) {
      const t = triangles[i]
      const a = t.Sites.item0.point
      const b = t.Sites.item1.point
      const c = t.Sites.item2.point
      this.centX[i] = (a.x + b.x + c.x) / 3
      this.centY[i] = (a.y + b.y + c.y) / 3

      const o0 = t.Sites.item0.Owner as Polyline
      const o1 = t.Sites.item1.Owner as Polyline
      const o2 = t.Sites.item2.Owner as Polyline
      this.obstacleOwner[i] = (o0 != null && o1 != null && o2 != null && o0 === o1 && o0 === o2) ? o0 : null

      let j = 0
      for (const e of t.Edges) {
        if (j >= 3) break
        const ot = e.GetOtherTriangle_T(t)
        if (ot == null) { j++; continue }
        const otId = triToId.get(ot)
        if (otId === undefined) { j++; continue }
        this.nbId[i * 3 + j] = otId
        this.nbEdge[i * 3 + j] = e
        const mx = (e.lowerSite.point.x + e.upperSite.point.x) * 0.5
        const my = (e.lowerSite.point.y + e.upperSite.point.y) * 0.5
        this.midX[i * 3 + j] = mx
        this.midY[i * 3 + j] = my
        j++
      }
    }
  }

  getId(t: CdtTriangle): number {
    return this.triToId.get(t) ?? -1
  }

  isInsideObstacle(id: number, allowedPolys: Set<Polyline>): boolean {
    const owner = this.obstacleOwner[id]
    return owner != null && !allowedPolys.has(owner)
  }
}

// ── Portal triangle helpers ─────────────────────────────────────────

/** Find portal triangles for an obstacle: free-space CDT triangles
 *  that share an edge with the obstacle boundary (at least two vertices
 *  belong to the obstacle polyline). */
export function findPortalTriangles(idx: TriangleIndex, obstaclePoly: Polyline): number[] {
  const portals: number[] = []
  for (let i = 0; i < idx.n; i++) {
    if (idx.obstacleOwner[i] != null) continue
    const t = idx.triangles[i]
    const count =
      (t.Sites.item0.Owner === obstaclePoly ? 1 : 0) +
      (t.Sites.item1.Owner === obstaclePoly ? 1 : 0) +
      (t.Sites.item2.Owner === obstaclePoly ? 1 : 0)
    if (count >= 2) {
      portals.push(i)
    }
  }
  return portals
}

/** BFS from one triangle to another, restricted to obstacle interior
 *  triangles of the given polyline (plus the endpoints themselves).
 *  Returns the sleeve (FrontEdge[]) for the short interior path. */
function findInteriorPath(
  idx: TriangleIndex,
  fromId: number,
  toId: number,
  obstaclePoly: Polyline,
): FrontEdge[] {
  if (fromId === toId) return []

  // Direct neighbor check (common case)
  const fromBase = fromId * 3
  for (let j = 0; j < 3; j++) {
    if (idx.nbId[fromBase + j] === toId) {
      return [{source: idx.triangles[fromId], edge: idx.nbEdge[fromBase + j]!}]
    }
  }

  // BFS restricted to interior triangles of obstaclePoly + the target
  const parentOf = new Map<number, number>()
  const parentEdge = new Map<number, CdtEdge>()
  const vis = new Set<number>()
  vis.add(fromId)
  const queue: number[] = [fromId]

  let found = false
  while (queue.length > 0 && !found) {
    const cur = queue.shift()!
    const curBase = cur * 3
    for (let j = 0; j < 3; j++) {
      const nb = idx.nbId[curBase + j]
      if (nb < 0 || vis.has(nb)) continue
      if (nb !== toId && idx.obstacleOwner[nb] !== obstaclePoly) continue
      vis.add(nb)
      parentOf.set(nb, cur)
      parentEdge.set(nb, idx.nbEdge[curBase + j]!)
      if (nb === toId) {
        found = true
        break
      }
      queue.push(nb)
    }
  }

  if (!found) return []

  const sleeve: FrontEdge[] = []
  let cur = toId
  while (cur !== fromId) {
    const p = parentOf.get(cur)
    const e = parentEdge.get(cur)
    if (p === undefined || !e) break
    sleeve.push({source: idx.triangles[p], edge: e})
    cur = p
  }
  return sleeve.reverse()
}

/** Flat min-heap on pre-allocated typed arrays (zero GC pressure). */
class FlatMinHeap {
  private keys: Float64Array
  private vals: Int32Array
  size = 0

  constructor(capacity: number) {
    this.keys = new Float64Array(capacity)
    this.vals = new Int32Array(capacity)
  }

  clear() { this.size = 0 }

  push(key: number, val: number) {
    const k = this.keys, v = this.vals
    let i = this.size++
    k[i] = key; v[i] = val
    while (i > 0) {
      const p = (i - 1) >> 1
      if (k[p] <= k[i]) break
      // swap
      const tk = k[i]; k[i] = k[p]; k[p] = tk
      const tv = v[i]; v[i] = v[p]; v[p] = tv
      i = p
    }
  }

  topKey(): number { return this.keys[0] }
  topVal(): number { return this.vals[0] }

  pop() {
    const k = this.keys, v = this.vals
    const last = --this.size
    if (last > 0) {
      k[0] = k[last]; v[0] = v[last]
      let i = 0
      for (;;) {
        let s = i; const l = 2 * i + 1, r = 2 * i + 2
        if (l < this.size && k[l] < k[s]) s = l
        if (r < this.size && k[r] < k[s]) s = r
        if (s === i) break
        const tk = k[i]; k[i] = k[s]; k[s] = tk
        const tv = v[i]; v[i] = v[s]; v[s] = tv
        i = s
      }
    }
  }
}

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

/** Midpoint of a CDT edge */
function edgeMidpoint(e: CdtEdge): Point {
  return e.lowerSite.point.add(e.upperSite.point).mul(0.5)
}

/** Dijkstra shortest-path tree on the CDT dual graph from a source triangle.
 *  Uses pre-indexed triangle data and typed arrays for minimal GC. */
function dijkstraTreeIndexed(
  sourceId: number,
  targetIds: Set<number>,
  allowedPolys: Set<Polyline>,
  idx: TriangleIndex,
  gScore: Float64Array,
  parentEdgeIdx: Int32Array, // stores i*3+j index into nbEdge, or -1
  visited: number[],
  heap: FlatMinHeap,
): void {
  gScore[sourceId] = 0
  parentEdgeIdx[sourceId] = -1
  visited.push(sourceId)
  heap.clear()
  heap.push(0, sourceId)

  let remaining = targetIds.size
  const foundTargets = new Set<number>()

  while (heap.size > 0 && remaining > 0) {
    const g = heap.topKey()
    const tid = heap.topVal()
    heap.pop()

    if (g > gScore[tid]) continue

    if (targetIds.has(tid) && !foundTargets.has(tid)) {
      foundTargets.add(tid)
      remaining--
      if (remaining === 0) break
    }

    // Entry point for distance calc
    const peIdx = parentEdgeIdx[tid]
    let entryX: number, entryY: number
    if (peIdx >= 0) {
      // midpoint of the entering edge
      entryX = idx.midX[peIdx]
      entryY = idx.midY[peIdx]
    } else {
      entryX = idx.centX[tid]
      entryY = idx.centY[tid]
    }

    const base = tid * 3
    for (let j = 0; j < 3; j++) {
      const otId = idx.nbId[base + j]
      if (otId < 0) continue
      // Don't go back through the same edge we entered from
      if (peIdx >= 0 && idx.nbEdge[base + j] === idx.nbEdge[peIdx]) continue

      if (idx.isInsideObstacle(otId, allowedPolys)) {
        // Allow reaching a target inside an obstacle
        if (targetIds.has(otId) && !foundTargets.has(otId)) {
          const mx = idx.midX[base + j]
          const my = idx.midY[base + j]
          const dx = entryX - mx, dy = entryY - my
          const tentativeG = g + Math.sqrt(dx * dx + dy * dy)
          if (tentativeG < gScore[otId]) {
            gScore[otId] = tentativeG
            // Find the reverse edge index: which of otId's neighbors is tid?
            const otBase = otId * 3
            for (let k = 0; k < 3; k++) {
              if (idx.nbId[otBase + k] === tid && idx.nbEdge[otBase + k] === idx.nbEdge[base + j]) {
                parentEdgeIdx[otId] = otBase + k
                break
              }
            }
            visited.push(otId)
            foundTargets.add(otId)
            remaining--
          }
        }
        continue
      }

      const mx = idx.midX[base + j]
      const my = idx.midY[base + j]
      const dx = entryX - mx, dy = entryY - my
      const tentativeG = g + Math.sqrt(dx * dx + dy * dy)

      if (tentativeG >= gScore[otId]) continue

      gScore[otId] = tentativeG
      // Store the reverse edge index on the neighbor
      const otBase = otId * 3
      for (let k = 0; k < 3; k++) {
        if (idx.nbId[otBase + k] === tid && idx.nbEdge[otBase + k] === idx.nbEdge[base + j]) {
          parentEdgeIdx[otId] = otBase + k
          break
        }
      }
      visited.push(otId)
      heap.push(tentativeG, otId)
    }
  }
}

/** Recover sleeve from indexed parent data */
function recoverSleeveIndexed(
  sourceId: number,
  targetId: number,
  parentEdgeIdx: Int32Array,
  idx: TriangleIndex,
): FrontEdge[] {
  const ret: FrontEdge[] = []
  let cur = targetId
  while (cur !== sourceId) {
    const peIdx = parentEdgeIdx[cur]
    if (peIdx < 0) break
    const e = idx.nbEdge[peIdx]!
    const parentId = idx.nbId[peIdx]
    ret.push({source: idx.triangles[parentId], edge: e})
    cur = parentId
  }
  return ret.reverse()
}

/** A* on indexed CDT dual graph from sourceId to the triangle containing target point.
 *  If triMask is non-null, neighbors with triMask[otId]===0 are skipped (but target-containing
 *  triangle is always reachable as fallback). */
function findSleeveAStarIndexed(
  sourceId: number,
  target: Point,
  allowedPolys: Set<Polyline>,
  idx: TriangleIndex,
  gScore: Float64Array,
  parentEdgeIdx: Int32Array,
  visited: number[],
  heap: FlatMinHeap,
  triMask: Uint8Array | null = null,
  targetId = -1,
): FrontEdge[] | null {
  gScore[sourceId] = 0
  parentEdgeIdx[sourceId] = -1
  visited.push(sourceId)
  heap.clear()

  const tx = target.x, ty = target.y
  const dx0 = idx.centX[sourceId] - tx, dy0 = idx.centY[sourceId] - ty
  heap.push(Math.sqrt(dx0 * dx0 + dy0 * dy0), sourceId)

  while (heap.size > 0) {
    const f = heap.topKey()
    const tid = heap.topVal()
    heap.pop()

    const g = gScore[tid]
    // Stale heap entry: popped f = g+h at push time; recompute h and drop if fresh g improved.
    const dxh = idx.centX[tid] - tx, dyh = idx.centY[tid] - ty
    const h = Math.sqrt(dxh * dxh + dyh * dyh)
    if (f > g + h + 1e-10) continue

    if (tid === targetId || idx.triangles[tid].containsPoint(target)) {
      return recoverSleeveIndexed(sourceId, tid, parentEdgeIdx, idx)
    }

    const peIdx = parentEdgeIdx[tid]
    let entryX: number, entryY: number
    if (peIdx >= 0) {
      entryX = idx.midX[peIdx]
      entryY = idx.midY[peIdx]
    } else {
      entryX = idx.centX[tid]
      entryY = idx.centY[tid]
    }

    const base = tid * 3
    for (let j = 0; j < 3; j++) {
      const otId = idx.nbId[base + j]
      if (otId < 0) continue
      if (peIdx >= 0 && idx.nbEdge[base + j] === idx.nbEdge[peIdx]) continue
      if (idx.isInsideObstacle(otId, allowedPolys) && !idx.triangles[otId].containsPoint(target)) continue
      // Mask-restricted corridor: only expand through masked-in triangles (target-triangle always OK).
      if (triMask !== null && triMask[otId] === 0 && !idx.triangles[otId].containsPoint(target)) continue

      const mx = idx.midX[base + j]
      const my = idx.midY[base + j]
      const dx = entryX - mx, dy = entryY - my
      const tentativeG = g + Math.sqrt(dx * dx + dy * dy)

      if (tentativeG >= gScore[otId]) continue

      gScore[otId] = tentativeG
      const otBase = otId * 3
      for (let k = 0; k < 3; k++) {
        if (idx.nbId[otBase + k] === tid && idx.nbEdge[otBase + k] === idx.nbEdge[base + j]) {
          parentEdgeIdx[otId] = otBase + k
          break
        }
      }
      visited.push(otId)
      // Use centroid-based heuristic consistently with the stale check in the main loop.
      const hx = idx.centX[otId] - tx, hy = idx.centY[otId] - ty
      heap.push(tentativeG + Math.sqrt(hx * hx + hy * hy), otId)
    }
  }
  return null
}

// ── Legacy wrappers (used by corridorRoute for single-edge routing) ──
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

    const edgeIntoT = cameFromEdge.get(t)
    // Entry point: midpoint of entering edge, or source centroid for the first triangle
    const entryPt = edgeIntoT ? edgeMidpoint(edgeIntoT) : triangleCentroid(t)

    for (const e of t.Edges) {
      if (edgeIntoT !== undefined && e === edgeIntoT) continue
      const ot = e.GetOtherTriangle_T(t)
      if (ot == null) continue
      if (triangleIsInsideObstacle(ot, allowedPolys)) {
        if (targetTriangles.has(ot) && !foundTargets.has(ot)) {
          const exitPt = edgeMidpoint(e)
          const edgeCost = entryPt.sub(exitPt).length
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

      const exitPt = edgeMidpoint(e)
      const edgeCost = entryPt.sub(exitPt).length
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
export function findSleeveAStar(
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

    const edgeIntoT = cameFromEdge.get(t)
    const entryPt = edgeIntoT ? edgeMidpoint(edgeIntoT) : triangleCentroid(t)

    for (const e of t.Edges) {
      if (!canCrossEdge(e, allowedPolys)) continue
      if (edgeIntoT !== undefined && e === edgeIntoT) continue
      const ot = e.GetOtherTriangle_T(t)
      if (ot == null) continue
      // Allow entering an obstacle triangle if it contains the target
      if (triangleIsInsideObstacle(ot, allowedPolys) && !ot.containsPoint(target)) continue

      const exitPt = edgeMidpoint(e)
      const edgeCost = entryPt.sub(exitPt).length
      const tentativeG = current.g + edgeCost

      const prevG = gScore.get(ot)
      if (prevG !== undefined && tentativeG >= prevG) continue

      gScore.set(ot, tentativeG)
      cameFromEdge.set(ot, e)
      const h = exitPt.sub(target).length
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

/** Cross product (b-a) × (c-a) */
function cross2d(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

/** Convert a sleeve into diagonals for the funnel algorithm.
 *  Walks the raw diagonals and collapses source/target obstacle vertices
 *  only when they create a wrong turn toward the node center. */
export function sleeveToDiagonals(
  sleeve: FrontEdge[],
  collapseSource?: {poly: Polyline; center: Point},
  collapseTarget?: {poly: Polyline; center: Point},
): Diagonal[] {
  // Step 1: Build raw diagonals with site info
  type RawDiag = {left: Point; right: Point; leftSite: CdtSite; rightSite: CdtSite}
  const raw: RawDiag[] = []
  for (const fe of sleeve) {
    const e = fe.edge
    const oppSite = fe.source.OppositeSite(e)
    if (
      Point.getTriangleOrientation(oppSite.point, e.lowerSite.point, e.upperSite.point) ===
      TriangleOrientation.Counterclockwise
    ) {
      raw.push({left: e.upperSite.point, right: e.lowerSite.point, leftSite: e.upperSite, rightSite: e.lowerSite})
    } else {
      raw.push({right: e.upperSite.point, left: e.lowerSite.point, leftSite: e.lowerSite, rightSite: e.upperSite})
    }
  }
  if (raw.length === 0) return []

  // Step 2: Wrong-turn detection
  // Right chain at target: (prev, this, center) right turn → cross < 0
  // Right chain at source: (center, this, next) right turn → cross < 0
  // Left chain at target:  (prev, this, center) left turn  → cross > 0
  // Left chain at source:  (center, this, next) left turn  → cross > 0

  // Step 2: Build unique subsequences (no repetitions) for left and right chains.
  // Track both firstIdx and lastIdx of consecutive duplicates so that
  // source collapse (i <= lastIdx) and target collapse (i >= firstIdx) cover all occurrences.
  function uniqueChain(chain: {pt: Point; site: CdtSite; idx: number}[]): {pt: Point; site: CdtSite; firstIdx: number; lastIdx: number}[] {
    const result: {pt: Point; site: CdtSite; firstIdx: number; lastIdx: number}[] = []
    for (const c of chain) {
      if (result.length === 0 || result[result.length - 1].pt.sub(c.pt).length > 1e-8) {
        result.push({pt: c.pt, site: c.site, firstIdx: c.idx, lastIdx: c.idx})
      } else {
        result[result.length - 1].lastIdx = c.idx
      }
    }
    return result
  }

  const leftChainRaw = raw.map((d, i) => ({pt: d.left, site: d.leftSite, idx: i}))
  const rightChainRaw = raw.map((d, i) => ({pt: d.right, site: d.rightSite, idx: i}))
  const L = uniqueChain(leftChainRaw)
  const R = uniqueChain(rightChainRaw)

  // Step 3: Right chain collapse
  // Source: find maximal k where rk belongs to source and (source_center, rk, r_{k+1}) is RIGHT rotation (cross < 0)
  let collapseRightFromSource = -1
  if (collapseSource) {
    for (let k = 0; k < R.length - 1; k++) {
      if (R[k].site.Owner !== collapseSource.poly) continue
      if (cross2d(collapseSource.center, R[k].pt, R[k + 1].pt) < -1e-10) {
        collapseRightFromSource = R[k].lastIdx
      }
    }
  }

  // Target: scan backward, find minimal k where rk belongs to target and (r_{k-1}, rk, target_center) is RIGHT rotation (cross < 0)
  let collapseRightFromTarget = raw.length
  if (collapseTarget) {
    for (let k = R.length - 1; k >= 1; k--) {
      if (R[k].site.Owner !== collapseTarget.poly) continue
      if (cross2d(R[k - 1].pt, R[k].pt, collapseTarget.center) < -1e-10) {
        collapseRightFromTarget = R[k].firstIdx
      }
    }
  }

  // Step 4: Left chain — source LEFT rotation (cross > 0), target LEFT rotation (cross > 0)
  let collapseLeftFromSource = -1
  if (collapseSource) {
    for (let k = 0; k < L.length - 1; k++) {
      if (L[k].site.Owner !== collapseSource.poly) continue
      if (cross2d(collapseSource.center, L[k].pt, L[k + 1].pt) > 1e-10) {
        collapseLeftFromSource = L[k].lastIdx
      }
    }
  }

  let collapseLeftFromTarget = raw.length
  if (collapseTarget) {
    for (let k = L.length - 1; k >= 1; k--) {
      if (L[k].site.Owner !== collapseTarget.poly) continue
      if (cross2d(L[k - 1].pt, L[k].pt, collapseTarget.center) > 1e-10) {
        collapseLeftFromTarget = L[k].firstIdx
      }
    }
  }

  // Step 5: Build final diagonals
  const diagonals: Diagonal[] = []
  for (let i = 0; i < raw.length; i++) {
    let leftPt = raw[i].left
    let rightPt = raw[i].right

    // Source collapse
    if (collapseSource && raw[i].leftSite.Owner === collapseSource.poly && i <= collapseLeftFromSource)
      leftPt = collapseSource.center
    if (collapseSource && raw[i].rightSite.Owner === collapseSource.poly && i <= collapseRightFromSource)
      rightPt = collapseSource.center

    // Target collapse
    if (collapseTarget && raw[i].leftSite.Owner === collapseTarget.poly && i >= collapseLeftFromTarget)
      leftPt = collapseTarget.center
    if (collapseTarget && raw[i].rightSite.Owner === collapseTarget.poly && i >= collapseRightFromTarget)
      rightPt = collapseTarget.center

    // Skip degenerate
    if (leftPt.sub(rightPt).length < 1e-8) continue

    diagonals.push({left: leftPt, right: rightPt})
  }
  return diagonals
}

/** Funnel algorithm: find the shortest path through a sequence of diagonals.
 *  Following https://page.mi.fu-berlin.de/mulzer/notes/alggeo/polySP.pdf */
export function funnelFromDiagonals(source: Point, target: Point, diagonals: Diagonal[]): Point[] {
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

  const collapseSource = sourcePoly ? {poly: sourcePoly, center: source} : undefined
  const collapseTarget = targetPoly ? {poly: targetPoly, center: target} : undefined
  const diagonals = sleeveToDiagonals(sleeve, collapseSource, collapseTarget)

  if (diagonals.length === 0) {
    return Polyline.mkFromPoints([source, target])
  }

  const points = funnelFromDiagonals(source, target, diagonals)
  return Polyline.mkFromPoints(points)
}

/** Check whether the graph contains cluster/subgraph nodes. */
function graphHasSubgraphs(geomGraph: GeomGraph): boolean {
  for (const n of geomGraph.shallowNodes) {
    if (n instanceof GeomGraph) return true
  }
  return false
}

/** Build a corridor triangle mask from a previous-level route curve.
 *  Samples the curve densely, point-locates each sample's triangle,
 *  then expands by 1-hop neighbors. Triangles owned by source/target
 *  polylines are always included so routing can leave/enter obstacles. */
export function buildCorridorMaskFromCurve(
  cdt: Cdt,
  idx: TriangleIndex,
  prevCurve: ICurve,
  sourcePoly: Polyline | undefined,
  targetPoly: Polyline | undefined,
  sampleStep = 5,
  maxSamples = 400,
): Uint8Array {
  const mask = new Uint8Array(idx.n)
  // Estimate sample count by curve parameter range; use bounding box diagonal as a hint.
  const pStart = prevCurve.parStart
  const pEnd = prevCurve.parEnd
  const bbDiag = prevCurve.boundingBox.diagonal
  const steps = Math.min(maxSamples, Math.max(16, Math.ceil(bbDiag / Math.max(0.5, sampleStep))))
  for (let s = 0; s <= steps; s++) {
    const t = pStart + ((pEnd - pStart) * s) / steps
    const p = prevCurve.value(t)
    const tri = findContainingTriangle(cdt, p)
    if (!tri) continue
    const id = idx.getId(tri)
    if (id < 0) continue
    mask[id] = 1
  }
  // 1-hop neighbor expansion
  const base = mask.slice()
  for (let i = 0; i < idx.n; i++) {
    if (base[i] === 0) continue
    const b = i * 3
    for (let j = 0; j < 3; j++) {
      const nb = idx.nbId[b + j]
      if (nb >= 0) mask[nb] = 1
    }
  }
  // Include all triangles owned by source/target polylines (obstacle interior + portal access).
  if (sourcePoly || targetPoly) {
    for (let i = 0; i < idx.n; i++) {
      const t = idx.triangles[i]
      const own = idx.obstacleOwner[i]
      if ((sourcePoly && own === sourcePoly) || (targetPoly && own === targetPoly)) {
        mask[i] = 1
        continue
      }
      // Also include portal triangles (at least two sites on source/target polyline).
      if (sourcePoly) {
        const c =
          (t.Sites.item0.Owner === sourcePoly ? 1 : 0) +
          (t.Sites.item1.Owner === sourcePoly ? 1 : 0) +
          (t.Sites.item2.Owner === sourcePoly ? 1 : 0)
        if (c >= 2) mask[i] = 1
      }
      if (targetPoly) {
        const c =
          (t.Sites.item0.Owner === targetPoly ? 1 : 0) +
          (t.Sites.item1.Owner === targetPoly ? 1 : 0) +
          (t.Sites.item2.Owner === targetPoly ? 1 : 0)
        if (c >= 2) mask[i] = 1
      }
    }
  }
  return mask
}

/** Route all edges using the corridor approach.
 *  Builds a CDT on padded obstacle polylines and routes each edge
 *  through the CDT dual graph with funnel optimization.
 *
 *  If `prevRoutes` is provided, each edge is routed with A* constrained to a
 *  corridor derived from its previous route (with 1-hop neighbor expansion
 *  and source/target obstacle triangles always allowed). On mask failure
 *  the edge falls back to unconstrained A*.
 *
 *  `extraObstaclePadding` (>= 0) is added to `padding` ONLY when building the
 *  CDT obstacles. This buys headroom for bezier smoothing bulge, arrowheads
 *  and edge labels so they don't visually overlap neighboring nodes at coarse
 *  tile levels. Trimming still uses the unscaled rendering boundary, so edges
 *  end exactly at the visible node border.
 */
export function routeCorridorEdges(
  geomGraph: GeomGraph,
  edgesToRoute: GeomEdge[],
  cancelToken: CancelToken,
  padding = 2,
  prevRoutes?: Map<GeomEdge, ICurve>,
  nodeScale?: (n: GeomNode) => number,
  activeNodes?: Set<GeomNode> | null,
  extraObstaclePadding = 0,
  debugLabel?: string,
): void {
  if (!edgesToRoute || edgesToRoute.length === 0) return

  // ensure ports exist — assign them directly to edges
  ensurePorts(edgesToRoute)

  if (graphHasSubgraphs(geomGraph)) {
    routeCorridorEdgesWithPassports(geomGraph, edgesToRoute, cancelToken, padding)
    return
  }

  // CH+HL preprocessing has O(n^2) memory for hub labels where n = number of CDT triangles.
  // Only use it for small graphs where the preprocessing cost is amortized and memory is manageable.
  // For large graphs, per-source Dijkstra with early termination is more memory-efficient.

  // build padded obstacle polylines from graph nodes (restrict to active nodes if given).
  const nodeToPolyline = new Map<unknown, Polyline>()
  const obstacles: Polyline[] = []
  const bb = Rectangle.mkEmpty()
  let scannedActive = 0
  for (const node of geomGraph.nodesBreadthFirst) {
    if (cancelToken && cancelToken.canceled) return
    if (node.boundaryCurve == null) continue
    if (activeNodes && !activeNodes.has(node)) continue
    scannedActive++
    let bc = node.boundaryCurve
    if (nodeScale) {
      const s = nodeScale(node)
      if (s && s !== 1) {
        const t = PlaneTransformation.scaleAroundCenterTransformation(s, s, node.center)
        bc = bc.transform(t)
      }
    }
    const poly = InteractiveObstacleCalculator.PaddedPolylineBoundaryOfNode(bc, padding + extraObstaclePadding)
    nodeToPolyline.set(node, poly)
    obstacles.push(poly)
    bb.addRecSelf(poly.boundingBox)
  }
  if (activeNodes) void activeNodes // silence unused if no logging
  void scannedActive

  // add bounding box so CDT covers the whole area
  bb.pad(Math.max(bb.diagonal / 4, 100))
  obstacles.push(bb.perimeter())

  // build CDT — do NOT add port locations as isolated sites,
  // because ports inside other nodes' obstacles would break
  // the obstacle-interior check (null-owner sites create holes).
  console.time('CorridorRouter CDT')
  const cdt = new Cdt([], obstacles, [])
  cdt.run()
  console.timeEnd("CorridorRouter CDT")

  // Build triangle index for fast typed-array Dijkstra/A*
  const idx = new TriangleIndex(cdt)

  // Pre-allocate reusable arrays for Dijkstra/A* (avoids per-call Map/GC overhead)
  const gScore = new Float64Array(idx.n).fill(Infinity)
  const parentEdgeIdx = new Int32Array(idx.n).fill(-1)
  const visited: number[] = []
  const heap = new FlatMinHeap(idx.n * 4)

  // Cache scaled boundary curves (used for trim so curves end at the visually enlarged node).
  const scaledBoundary = new Map<unknown, ICurve>()
  const boundaryOf = (n: GeomNode): ICurve => {
    if (!nodeScale) return n.boundaryCurve
    const cached = scaledBoundary.get(n)
    if (cached) return cached
    const s = nodeScale(n)
    if (!s || s === 1) {
      scaledBoundary.set(n, n.boundaryCurve)
      return n.boundaryCurve
    }
    const t = PlaneTransformation.scaleAroundCenterTransformation(s, s, n.center)
    const bc = n.boundaryCurve.transform(t)
    scaledBoundary.set(n, bc)
    return bc
  }

  // Corridor-guided per-edge A* path: used when prevRoutes is provided,
  // e.g. for rerouting a coarser tile level while honoring the finer level's shape.
  if (prevRoutes && prevRoutes.size > 0) {
    console.time('CorridorRouter routing (corridor-guided)')
    let straightFallbacks = 0
    let maskedFailures = 0
    let unconstrainedFailures = 0
    let missingContainingTri = 0
    let allowAllRescues = 0
    let emptySleeve = 0
    let sameTriangle = 0
    for (const edge of edgesToRoute) {
      if (cancelToken && cancelToken.canceled) return
      if (edge.sourcePort == null || edge.targetPort == null) continue
      const source = edge.source.center
      const target = edge.target.center
      const sourcePoly = nodeToPolyline.get(edge.source)
      const targetPoly = nodeToPolyline.get(edge.target)
      const sourceTri = findContainingTriangle(cdt, source)
      const targetTri = findContainingTriangle(cdt, target)
      if (!sourceTri || !targetTri) {
        missingContainingTri++
        const fallback = Polyline.mkFromPoints([source, target])
        edge.curve = fallback.toCurve()
        edge.smoothedPolyline = SmoothedPolyline.mkFromPoints([source, target])
        Arrowhead.trimSplineAndCalculateArrowheadsII(edge, boundaryOf(edge.source), boundaryOf(edge.target), edge.curve, false)
        continue
      }
      const sourceId = idx.getId(sourceTri)
      if (sourceId < 0) continue
      const tId = idx.getId(targetTri)
      if (tId === sourceId) sameTriangle++

      const prev = prevRoutes.get(edge)
      // TEMP: disable the prev-curve mask hint and run unconstrained A*
      // directly, to test whether mask was steering paths through bad regions.
      const mask: Uint8Array | null = null
      void prev
      if (mask) (mask as Uint8Array)[sourceId] = 1
      if (mask && tId >= 0) (mask as Uint8Array)[tId] = 1

      const allowedBoth = new Set<Polyline>()
      if (sourcePoly) allowedBoth.add(sourcePoly)
      if (targetPoly) allowedBoth.add(targetPoly)

      let sleeve = findSleeveAStarIndexed(sourceId, target, allowedBoth, idx, gScore, parentEdgeIdx, visited, heap, mask, tId)
      for (const v of visited) { gScore[v] = Infinity; parentEdgeIdx[v] = -1 }
      visited.length = 0

      if ((!sleeve || sleeve.length === 0) && mask) {
        maskedFailures++
        sleeve = findSleeveAStarIndexed(sourceId, target, allowedBoth, idx, gScore, parentEdgeIdx, visited, heap, null, tId)
        for (const v of visited) { gScore[v] = Infinity; parentEdgeIdx[v] = -1 }
        visited.length = 0
        if (!sleeve || sleeve.length === 0) unconstrainedFailures++
      }

      // Third-tier fallback: A* with every obstacle allowed (ignores
      // the obstacle-interior guard completely). If this finds a path
      // while the previous call did not, it means the target center
      // actually lies inside some OTHER node's inflated obstacle and
      // the straight fallback was being used — which produces the
      // long cross-node segments seen on coarser levels.
      if (!sleeve || sleeve.length === 0) {
        const allowAll = new Set<Polyline>()
        for (const p of nodeToPolyline.values()) allowAll.add(p)
        sleeve = findSleeveAStarIndexed(sourceId, target, allowAll, idx, gScore, parentEdgeIdx, visited, heap, null, tId)
        for (const v of visited) { gScore[v] = Infinity; parentEdgeIdx[v] = -1 }
        visited.length = 0
        if (sleeve && sleeve.length > 0) allowAllRescues++
      }

      if (!sleeve || sleeve.length === 0) {
        if (sleeve && sleeve.length === 0) emptySleeve++
        straightFallbacks++
        // Sleeve search failed in both masked and unconstrained modes. Use a
        // straight segment between the (current-scale) node centers: it reaches
        // both vertices and the arrowhead/boundary trim below cuts it cleanly.
        // Reusing `prev` here would leave a visible gap because it was trimmed
        // at the *finer* level's smaller boundary, which sits inside this
        // level's larger scaled boundary.
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
          edge.smoothedPolyline = SmoothedPolyline.mkFromPoints(poly)
          smoothenCorners(edge.smoothedPolyline, padding)
          edge.curve = edge.smoothedPolyline.createCurve()
        }
      }
      Arrowhead.trimSplineAndCalculateArrowheadsII(
        edge, boundaryOf(edge.source), boundaryOf(edge.target), edge.curve, false,
      )
    }
    console.log(`[corridor] total=${edgesToRoute.length} missingTri=${missingContainingTri} sameTri=${sameTriangle} emptySleeve=${emptySleeve} maskedFail=${maskedFailures} unconstrainedFail=${unconstrainedFailures} allowAllRescues=${allowAllRescues} straightFallback=${straightFallbacks}`)
    console.timeEnd('CorridorRouter routing (corridor-guided)')

    return
  }

  // route edges using indexed Dijkstra tree per source node
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

    const sourceId = idx.getId(sourceTriangle)
    if (sourceId < 0) continue

    // Find all target triangles for this source
    const targetInfos: {edge: GeomEdge; target: Point; targetPoly?: Polyline; targetId: number}[] = []
    const targetIds = new Set<number>()
    for (const edge of edges) {
      const target = edge.target.center
      const targetPoly = nodeToPolyline.get(edge.target)
      const targetTriangle = findContainingTriangle(cdt, target)
      if (!targetTriangle) {
        const fallback = Polyline.mkFromPoints([source, target])
        edge.curve = fallback.toCurve()
        edge.smoothedPolyline = SmoothedPolyline.mkFromPoints([source, target])
        Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false)
        continue
      }
      const targetId = idx.getId(targetTriangle)
      if (targetId < 0) continue
      targetInfos.push({edge, target, targetPoly, targetId})
      targetIds.add(targetId)
    }

    if (targetInfos.length === 0) continue

    const allowed = new Set<Polyline>()
    if (sourcePoly) allowed.add(sourcePoly)

    // Single indexed Dijkstra from source to all target triangles
    dijkstraTreeIndexed(sourceId, targetIds, allowed, idx, gScore, parentEdgeIdx, visited, heap)

    // Process Dijkstra-reachable edges; collect unreachable for A* fallback
    const fallbackEdges: {edge: GeomEdge; target: Point; targetPoly?: Polyline}[] = []
    for (const {edge, target, targetPoly, targetId} of targetInfos) {
      if (gScore[targetId] === Infinity) {
        fallbackEdges.push({edge, target, targetPoly})
        continue
      }
      const sleeve = recoverSleeveIndexed(sourceId, targetId, parentEdgeIdx, idx)
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
          edge.smoothedPolyline = SmoothedPolyline.mkFromPoints(poly)
          smoothenCorners(edge.smoothedPolyline, padding)
          edge.curve = edge.smoothedPolyline.createCurve()
        }
      }
      Arrowhead.trimSplineAndCalculateArrowheadsII(
        edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false,
      )
    }

    // Reset Dijkstra state before A* fallbacks
    for (const v of visited) { gScore[v] = Infinity; parentEdgeIdx[v] = -1 }
    visited.length = 0

    // A* fallback for edges Dijkstra couldn't reach (target inside obstacle)
    for (const {edge, target, targetPoly} of fallbackEdges) {
      const allowedBoth = new Set<Polyline>()
      if (sourcePoly) allowedBoth.add(sourcePoly)
      if (targetPoly) allowedBoth.add(targetPoly)

      const sleeve = findSleeveAStarIndexed(sourceId, target, allowedBoth, idx, gScore, parentEdgeIdx, visited, heap)
      if (sleeve && sleeve.length > 0) {
        const collapseSource = sourcePoly ? {poly: sourcePoly, center: source} : undefined
        const collapseTarget = targetPoly ? {poly: targetPoly, center: target} : undefined
        const diagonals = sleeveToDiagonals(sleeve, collapseSource, collapseTarget)
        if (diagonals.length > 0) {
          const points = funnelFromDiagonals(source, target, diagonals)
          const poly = Polyline.mkFromPoints(points)
          edge.smoothedPolyline = SmoothedPolyline.mkFromPoints(poly)
          smoothenCorners(edge.smoothedPolyline, padding)
          edge.curve = edge.smoothedPolyline.createCurve()
        } else {
          const pts = Polyline.mkFromPoints([source, target])
          edge.curve = pts.toCurve()
          edge.smoothedPolyline = SmoothedPolyline.mkFromPoints([source, target])
        }
      } else if (!sleeve || sleeve.length === 0) {
        // A* found source == target triangle
        const pts = Polyline.mkFromPoints([source, target])
        edge.curve = pts.toCurve()
        edge.smoothedPolyline = SmoothedPolyline.mkFromPoints([source, target])
      }
      Arrowhead.trimSplineAndCalculateArrowheadsII(
        edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false,
      )
      // Reset for next A* call
      for (const v of visited) { gScore[v] = Infinity; parentEdgeIdx[v] = -1 }
      visited.length = 0
    }

    // Reset reusable arrays for next source node
    for (const v of visited) { gScore[v] = Infinity; parentEdgeIdx[v] = -1 }
    visited.length = 0
  }
  console.timeEnd('CorridorRouter routing')
}

/** Adjust bezier coefficients at each corner so curves stay within padding
 *  of the original polyline path — same approach as SplineRouter. */
function smoothenCorners(sp: SmoothedPolyline, loosePadding: number): void {
  let a: CornerSite = sp.headSite
  let corner: {b: CornerSite; c: CornerSite} | undefined
  while ((corner = Curve.findCorner(a))) {
    a = smoothOneCorner(a, corner.c, corner.b, loosePadding)
  }
}

function smoothOneCorner(a: CornerSite, c: CornerSite, b: CornerSite, loosePadding: number): CornerSite {
  const mult = 1.5
  const kMin = 0.01
  let k = 0.5
  let seg: BezierSeg
  let v: number
  let u: number
  if (a.prev == null) {
    u = 2
    v = 1
  } else if (c.next == null) {
    u = 1
    v = 2
  } else {
    u = v = 1
  }

  do {
    seg = Curve.createBezierSeg(k * u, k * v, a, b, c)
    b.previouisBezierCoefficient = k * u
    b.nextBezierCoefficient = k * v
    k /= mult
  } while (distFromCornerToSeg() > loosePadding && k > kMin)
  k *= mult
  if (k < 0.5 && k > kMin) {
    k = 0.5 * (k + k * mult)
    seg = Curve.createBezierSeg(k * u, k * v, a, b, c)
    if (distFromCornerToSeg() > loosePadding) {
      b.previouisBezierCoefficient = k * u
      b.nextBezierCoefficient = k * v
    }
  }

  return b

  function distFromCornerToSeg(): number {
    const t = seg.closestParameter(b.point)
    return b.point.sub(seg.value(t)).length
  }
}

// ── Hub-Labels–based corridor routing ───────────────────────────────

/** Set a straight-line fallback on an edge. */
function setStraightLine(edge: GeomEdge, source: Point, target: Point): void {
  const pts = Polyline.mkFromPoints([source, target])
  edge.curve = pts.toCurve()
  edge.smoothedPolyline = SmoothedPolyline.mkFromPoints([source, target])
}

type PortalInfo = {triIdx: number; chIdx: number}

/** Route all edges using the corridor approach with Hub Labels.
 *
 *  Instead of per-source Dijkstra on the full CDT, this approach:
 *  1. Builds CH + hub labels on the **free-space** CDT (no obstacle interiors).
 *  2. For each graph node, identifies its **portal triangles** — free-space
 *     CDT triangles adjacent to the obstacle boundary.
 *  3. For each edge w→u, queries HL for all (w_i, u_j) portal pairs,
 *     picks the shortest, recovers the corridor, and extends to centers.
 *
 *  This avoids the allowedPolys per-query issue: free-space CH/HL is
 *  valid for all queries since obstacle interiors are excluded. */
export function routeCorridorEdgesHL(
  geomGraph: GeomGraph,
  edgesToRoute: GeomEdge[],
  cancelToken: CancelToken,
  padding = 2,
): void {
  if (!edgesToRoute || edgesToRoute.length === 0) return

  // Ensure ports exist
  ensurePorts(edgesToRoute)

  // Build padded obstacle polylines
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
  bb.pad(Math.max(bb.diagonal / 4, 100))
  obstacles.push(bb.perimeter())

  // Build CDT
  console.time('CorridorRouterHL CDT')
  const cdt = new Cdt([], obstacles, [])
  cdt.run()
  console.timeEnd('CorridorRouterHL CDT')

  // Build triangle index
  const idx = new TriangleIndex(cdt)

  // Build free-space CH + HL
  console.time('CorridorRouterHL CH+HL')
  const ch = new ContractionHierarchy(cdt, freeSpaceFilter)
  const hl = new HubLabels(ch)
  console.timeEnd('CorridorRouterHL CH+HL')

  // Precompute portal triangles for each node
  const nodePortals = new Map<GeomNode, PortalInfo[]>()
  for (const node of geomGraph.nodesBreadthFirst) {
    if (node.boundaryCurve == null) continue
    const poly = nodeToPolyline.get(node) as Polyline | undefined
    if (!poly) continue
    const portalTriIds = findPortalTriangles(idx, poly)
    const portals: PortalInfo[] = []
    for (const triId of portalTriIds) {
      const chIdx = ch.getIndex(idx.triangles[triId])
      if (chIdx !== undefined) portals.push({triIdx: triId, chIdx})
    }
    nodePortals.set(node, portals)
  }

  // Route each edge
  console.time('CorridorRouterHL routing')
  for (const edge of edgesToRoute) {
    if (cancelToken && cancelToken.canceled) return
    if (edge.sourcePort == null || edge.targetPort == null) continue

    const source = edge.source.center
    const target = edge.target.center
    const sourcePoly = nodeToPolyline.get(edge.source) as Polyline | undefined
    const targetPoly = nodeToPolyline.get(edge.target) as Polyline | undefined

    const srcPortals = nodePortals.get(edge.source) ?? []
    const tgtPortals = nodePortals.get(edge.target) ?? []

    const sourceTriangle = findContainingTriangle(cdt, source)
    const targetTriangle = findContainingTriangle(cdt, target)
    if (!sourceTriangle || !targetTriangle) {
      setStraightLine(edge, source, target)
      Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false)
      continue
    }

    const sourceTriId = idx.getId(sourceTriangle)
    const targetTriId = idx.getId(targetTriangle)
    if (sourceTriId < 0 || targetTriId < 0) {
      setStraightLine(edge, source, target)
      Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false)
      continue
    }

    if (srcPortals.length === 0 || tgtPortals.length === 0) {
      setStraightLine(edge, source, target)
      Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false)
      continue
    }

    // Query HL for all portal pairs, pick shortest total distance
    let bestDist = Infinity
    let bestSrc: PortalInfo | null = null
    let bestTgt: PortalInfo | null = null

    for (const sp of srcPortals) {
      const extSrc = Math.sqrt(
        (source.x - idx.centX[sp.triIdx]) * (source.x - idx.centX[sp.triIdx]) +
        (source.y - idx.centY[sp.triIdx]) * (source.y - idx.centY[sp.triIdx]),
      )
      for (const tp of tgtPortals) {
        const hlDist = hl.query(sp.chIdx, tp.chIdx)
        if (hlDist === Infinity) continue
        const extTgt = Math.sqrt(
          (target.x - idx.centX[tp.triIdx]) * (target.x - idx.centX[tp.triIdx]) +
          (target.y - idx.centY[tp.triIdx]) * (target.y - idx.centY[tp.triIdx]),
        )
        const totalDist = extSrc + hlDist + extTgt
        if (totalDist < bestDist) {
          bestDist = totalDist
          bestSrc = sp
          bestTgt = tp
        }
      }
    }

    if (!bestSrc || !bestTgt) {
      setStraightLine(edge, source, target)
      Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false)
      continue
    }

    // Recover free-space sleeve from HL
    const hlSleeve = hl.recoverSleeve(bestSrc.chIdx, bestTgt.chIdx)

    // Find interior paths: center → portal (source) and portal → center (target)
    const srcInterior = sourcePoly ? findInteriorPath(idx, sourceTriId, bestSrc.triIdx, sourcePoly) : []
    const tgtInterior = targetPoly ? findInteriorPath(idx, bestTgt.triIdx, targetTriId, targetPoly) : []

    // Stitch sleeves: interior_src + free-space HL + interior_tgt
    const fullSleeve: FrontEdge[] = [...srcInterior, ...(hlSleeve ?? []), ...tgtInterior]

    if (fullSleeve.length === 0) {
      setStraightLine(edge, source, target)
    } else {
      const collapseSource = sourcePoly ? {poly: sourcePoly, center: source} : undefined
      const collapseTarget = targetPoly ? {poly: targetPoly, center: target} : undefined
      const diagonals = sleeveToDiagonals(fullSleeve, collapseSource, collapseTarget)
      if (diagonals.length === 0) {
        setStraightLine(edge, source, target)
      } else {
        const points = funnelFromDiagonals(source, target, diagonals)
        const poly = Polyline.mkFromPoints(points)
        edge.smoothedPolyline = SmoothedPolyline.mkFromPoints(poly)
        smoothenCorners(edge.smoothedPolyline, padding)
        edge.curve = edge.smoothedPolyline.createCurve()
      }
    }
    Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false)
  }
  console.timeEnd('CorridorRouterHL routing')
}

/** Ensure all edges have ports. */
function ensurePorts(edges: GeomEdge[]): void {
  for (const edge of edges) {
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
}

/** Route edges using corridor approach with passport support for subgraphs.
 *  Edges are grouped by passport, and each group gets its own obstacle set and CDT. */
function routeCorridorEdgesWithPassports(
  geomGraph: GeomGraph,
  edgesToRoute: GeomEdge[],
  cancelToken: CancelToken,
  padding: number,
): void {
  // Build shape hierarchy
  const shapes = ShapeCreator.GetShapes(geomGraph, edgesToRoute)
  const rootShapes = shapes.filter((s) => s.Parents == null || s.Parents.length === 0)
  let root: Shape
  let rootWasCreated = false
  if (rootShapes.length === 1 && rootShapes[0].BoundaryCurve == null) {
    root = rootShapes[0]
  } else {
    rootWasCreated = true
    root = new Shape(null)
    for (const rs of rootShapes) root.AddChild(rs)
  }

  const ancestorSets = getAncestorSetsMap(Array.from(root.Descendants()))
  const portsToShapes = calculatePortsToShapes(root, edgesToRoute)

  // Group edges by passport
  const edgeGroups = groupEdgesByPassport(edgesToRoute, portsToShapes, ancestorSets, root)

  // Route each passport group with its own obstacle set + CDT
  for (const group of edgeGroups) {
    if (cancelToken && cancelToken.canceled) break
    const obstacleShapes = getObstaclesFromPassport(group.passport, ancestorSets, root)
    routeCorridorEdgeGroup(geomGraph, group.edges, obstacleShapes, cancelToken, padding)
  }

  // Clean up root
  if (rootWasCreated) {
    for (const rs of rootShapes) rs.RemoveParent(root)
  }
}

/** Route a group of edges that share the same passport (obstacle set). */
function routeCorridorEdgeGroup(
  geomGraph: GeomGraph,
  edges: GeomEdge[],
  obstacleShapes: Set<Shape>,
  cancelToken: CancelToken,
  padding: number,
): void {
  // Build padded obstacle polylines only from obstacle shapes
  const nodeToPolyline = new Map<GeomNode, Polyline>()
  const obstacles: Polyline[] = []
  const bb = Rectangle.mkEmpty()

  // Map obstacle shapes to their polylines
  for (const shape of obstacleShapes) {
    if (shape.BoundaryCurve == null) continue
    const node = shape instanceof RelativeShape ? shape.node : null
    const poly = InteractiveObstacleCalculator.PaddedPolylineBoundaryOfNode(shape.BoundaryCurve, padding)
    if (node) nodeToPolyline.set(node, poly)
    obstacles.push(poly)
    bb.addRecSelf(poly.boundingBox)
  }

  // Also ensure source/target nodes have polylines (they may not be obstacles)
  for (const edge of edges) {
    for (const node of [edge.source, edge.target]) {
      if (!nodeToPolyline.has(node) && node.boundaryCurve != null) {
        const poly = InteractiveObstacleCalculator.PaddedPolylineBoundaryOfNode(node.boundaryCurve, padding)
        nodeToPolyline.set(node, poly)
      }
    }
  }

  if (obstacles.length === 0 && edges.length > 0) {
    // No obstacles — compute bounding box from edge endpoints
    for (const edge of edges) {
      if (edge.source.boundaryCurve) bb.addRecSelf(edge.source.boundingBox)
      if (edge.target.boundaryCurve) bb.addRecSelf(edge.target.boundingBox)
    }
  }

  bb.pad(Math.max(bb.diagonal / 4, 100))
  obstacles.push(bb.perimeter())

  // Build CDT
  const cdt = new Cdt([], obstacles, [])
  cdt.run()

  const idx = new TriangleIndex(cdt)
  const gScore = new Float64Array(idx.n).fill(Infinity)
  const parentEdgeIdx = new Int32Array(idx.n).fill(-1)
  const visited: number[] = []
  const heap = new FlatMinHeap(idx.n * 4)

  // Group edges by source node
  const edgesBySource = new Map<GeomNode, GeomEdge[]>()
  for (const edge of edges) {
    if (cancelToken && cancelToken.canceled) return
    if (edge.sourcePort == null || edge.targetPort == null) continue
    let list = edgesBySource.get(edge.source)
    if (!list) { list = []; edgesBySource.set(edge.source, list) }
    list.push(edge)
  }

  for (const [sourceNode, srcEdges] of edgesBySource) {
    if (cancelToken && cancelToken.canceled) return
    const source = sourceNode.center
    const sourcePoly = nodeToPolyline.get(sourceNode)
    const sourceTriangle = findContainingTriangle(cdt, source)
    if (!sourceTriangle) {
      for (const edge of srcEdges) {
        const target = edge.target.center
        setStraightLine(edge, source, target)
        Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false)
      }
      continue
    }

    const sourceId = idx.getId(sourceTriangle)
    if (sourceId < 0) continue

    const targetInfos: {edge: GeomEdge; target: Point; targetPoly?: Polyline; targetId: number}[] = []
    const targetIds = new Set<number>()
    for (const edge of srcEdges) {
      const target = edge.target.center
      const targetPoly = nodeToPolyline.get(edge.target)
      const targetTriangle = findContainingTriangle(cdt, target)
      if (!targetTriangle) {
        setStraightLine(edge, source, target)
        Arrowhead.trimSplineAndCalculateArrowheadsII(edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false)
        continue
      }
      const targetId = idx.getId(targetTriangle)
      if (targetId < 0) continue
      targetInfos.push({edge, target, targetPoly, targetId})
      targetIds.add(targetId)
    }

    if (targetInfos.length === 0) continue

    const allowed = new Set<Polyline>()
    if (sourcePoly) allowed.add(sourcePoly)

    dijkstraTreeIndexed(sourceId, targetIds, allowed, idx, gScore, parentEdgeIdx, visited, heap)

    const fallbackEdges: {edge: GeomEdge; target: Point; targetPoly?: Polyline}[] = []
    for (const {edge, target, targetPoly, targetId} of targetInfos) {
      if (gScore[targetId] === Infinity) {
        fallbackEdges.push({edge, target, targetPoly})
        continue
      }
      const sleeve = recoverSleeveIndexed(sourceId, targetId, parentEdgeIdx, idx)
      if (sleeve.length === 0) {
        setStraightLine(edge, source, target)
      } else {
        const collapseSource = sourcePoly ? {poly: sourcePoly, center: source} : undefined
        const collapseTarget = targetPoly ? {poly: targetPoly, center: target} : undefined
        const diagonals = sleeveToDiagonals(sleeve, collapseSource, collapseTarget)
        if (diagonals.length === 0) {
          setStraightLine(edge, source, target)
        } else {
          const points = funnelFromDiagonals(source, target, diagonals)
          const poly = Polyline.mkFromPoints(points)
          edge.smoothedPolyline = SmoothedPolyline.mkFromPoints(poly)
          smoothenCorners(edge.smoothedPolyline, padding)
          edge.curve = edge.smoothedPolyline.createCurve()
        }
      }
      Arrowhead.trimSplineAndCalculateArrowheadsII(
        edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false,
      )
    }

    for (const v of visited) { gScore[v] = Infinity; parentEdgeIdx[v] = -1 }
    visited.length = 0

    for (const {edge, target, targetPoly} of fallbackEdges) {
      const allowedBoth = new Set<Polyline>()
      if (sourcePoly) allowedBoth.add(sourcePoly)
      if (targetPoly) allowedBoth.add(targetPoly)

      const sleeve = findSleeveAStarIndexed(sourceId, target, allowedBoth, idx, gScore, parentEdgeIdx, visited, heap)
      if (sleeve && sleeve.length > 0) {
        const collapseSource = sourcePoly ? {poly: sourcePoly, center: source} : undefined
        const collapseTarget = targetPoly ? {poly: targetPoly, center: target} : undefined
        const diagonals = sleeveToDiagonals(sleeve, collapseSource, collapseTarget)
        if (diagonals.length > 0) {
          const points = funnelFromDiagonals(source, target, diagonals)
          const poly = Polyline.mkFromPoints(points)
          edge.smoothedPolyline = SmoothedPolyline.mkFromPoints(poly)
          smoothenCorners(edge.smoothedPolyline, padding)
          edge.curve = edge.smoothedPolyline.createCurve()
        } else {
          setStraightLine(edge, source, target)
        }
      } else {
        setStraightLine(edge, source, target)
      }
      Arrowhead.trimSplineAndCalculateArrowheadsII(
        edge, edge.source.boundaryCurve, edge.target.boundaryCurve, edge.curve, false,
      )
      for (const v of visited) { gScore[v] = Infinity; parentEdgeIdx[v] = -1 }
      visited.length = 0
    }

    for (const v of visited) { gScore[v] = Infinity; parentEdgeIdx[v] = -1 }
    visited.length = 0
  }
}
