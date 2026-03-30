import {join} from 'path'
import * as fs from 'fs'
import {parseJSON} from '../../../parser/src/dotparser'
import {
  GeomGraph,
  GeomEdge,
  GeomNode,
  layoutGeomGraph,
  EdgeRoutingMode,
  Point,
  MdsLayoutSettings,
} from '../../../core/src'
import {DrawingGraph} from '../../../drawing/src'
import {Polyline} from '../../../core/src/math/geometry/polyline'
import {Rectangle} from '../../../core/src/math/geometry/rectangle'
import {DebugCurve} from '../../../core/src/math/geometry/debugCurve'
import {SvgDebugWriter} from '../utils/svgDebugWriter'
import {Cdt} from '../../../core/src/routing/ConstrainedDelaunayTriangulation/Cdt'
import {CdtTriangle} from '../../../core/src/routing/ConstrainedDelaunayTriangulation/CdtTriangle'
import {InteractiveObstacleCalculator} from '../../../core/src/routing/interactiveObstacleCalculator'
import {findContainingTriangle} from '../../../core/src/routing/corridorRouter'
import {CdtSite} from '../../../core/src/routing/ConstrainedDelaunayTriangulation/CdtSite'
import {CdtEdge} from '../../../core/src/routing/ConstrainedDelaunayTriangulation/CdtEdge'
import {LineSegment} from '../../../core/src/math/geometry/lineSegment'
import {TriangleOrientation} from '../../../core/src/math/geometry/point'

// Reproduce the CDT and routing internals to dump figures
function buildCdtAndObstacles(gg: GeomGraph, padding: number) {
  const nodeToPolyline = new Map<GeomNode, Polyline>()
  const obstacles: Polyline[] = []
  const bb = Rectangle.mkEmpty()
  for (const node of gg.nodesBreadthFirst) {
    if (node.boundaryCurve == null) continue
    const poly = InteractiveObstacleCalculator.PaddedPolylineBoundaryOfNode(node.boundaryCurve, padding)
    nodeToPolyline.set(node, poly)
    obstacles.push(poly)
    bb.addRecSelf(poly.boundingBox)
  }
  bb.pad(Math.max(bb.diagonal / 4, 100))
  obstacles.push(bb.perimeter())

  const cdt = new Cdt([], obstacles, [])
  cdt.run()
  return {cdt, nodeToPolyline, obstacles}
}

// Find sleeve using A* (reimplemented inline to capture intermediate state)
function findSleeveAndTriangles(
  cdt: Cdt,
  source: Point,
  target: Point,
  allowedPolys: Set<Polyline>,
): {sleeve: CdtTriangle[]} | null {
  const sourceTriangle = findContainingTriangle(cdt, source)
  if (!sourceTriangle) return null

  function triangleCentroid(t: CdtTriangle): Point {
    const a = t.Sites.item0.point
    const b = t.Sites.item1.point
    const c = t.Sites.item2.point
    return new Point((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3)
  }

  function triangleIsInsideObstacle(t: CdtTriangle): boolean {
    const o0 = t.Sites.item0.Owner as Polyline
    const o1 = t.Sites.item1.Owner as Polyline
    const o2 = t.Sites.item2.Owner as Polyline
    if (o0 == null || o1 == null || o2 == null) return false
    if (o0 !== o1 || o0 !== o2) return false
    return !allowedPolys.has(o0)
  }

  const gScore = new Map<CdtTriangle, number>()
  const cameFrom = new Map<CdtTriangle, CdtTriangle | undefined>()
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
  function heapPop() {
    const top = open[0]
    const last = open.pop()!
    if (open.length > 0) {
      open[0] = last
      let i = 0
      while (true) {
        let smallest = i
        const l = 2 * i + 1, r = 2 * i + 2
        if (l < open.length && (open[l].f < open[smallest].f || (open[l].f === open[smallest].f && open[l].seq < open[smallest].seq))) smallest = l
        if (r < open.length && (open[r].f < open[smallest].f || (open[r].f === open[smallest].f && open[r].seq < open[smallest].seq))) smallest = r
        if (smallest === i) break
        const tmp = open[i]; open[i] = open[smallest]; open[smallest] = tmp
        i = smallest
      }
    }
    return top
  }

  const h0 = triangleCentroid(sourceTriangle).sub(target).length
  gScore.set(sourceTriangle, 0)
  cameFrom.set(sourceTriangle, undefined)
  heapPush({f: h0, g: 0, t: sourceTriangle, seq: seqCounter++})

  while (open.length > 0) {
    const current = heapPop()
    const t = current.t
    if (current.g > (gScore.get(t) ?? Infinity)) continue
    if (t.containsPoint(target)) {
      // Recover sleeve as list of triangles
      const sleeve: CdtTriangle[] = [t]
      for (let tr = t; cameFrom.get(tr) !== undefined; ) {
        tr = cameFrom.get(tr)!
        sleeve.push(tr)
      }
      sleeve.reverse()
      return {sleeve}
    }
    const tCentroid = triangleCentroid(t)
    for (const e of t.Edges) {
      const ot = e.GetOtherTriangle_T(t)
      if (ot == null) continue
      if (triangleIsInsideObstacle(ot)) continue
      const otCentroid = triangleCentroid(ot)
      const tentativeG = current.g + tCentroid.sub(otCentroid).length
      const prevG = gScore.get(ot)
      if (prevG !== undefined && tentativeG >= prevG) continue
      gScore.set(ot, tentativeG)
      cameFrom.set(ot, t)
      heapPush({f: tentativeG + otCentroid.sub(target).length, g: tentativeG, t: ot, seq: seqCounter++})
    }
  }
  return null
}

function triangleToPolyline(t: CdtTriangle): Polyline {
  const p = new Polyline()
  p.addPoint(t.Sites.item0.point)
  p.addPoint(t.Sites.item1.point)
  p.addPoint(t.Sites.item2.point)
  p.closed = true
  return p
}

function dumpEdgeFigure(
  fileName: string,
  edge: GeomEdge,
  gg: GeomGraph,
  cdt: Cdt,
  nodeToPolyline: Map<GeomNode, Polyline>,
) {
  const source = edge.source.center
  const target = edge.target.center
  const sourcePoly = nodeToPolyline.get(edge.source)
  const targetPoly = nodeToPolyline.get(edge.target)
  const allowed = new Set<Polyline>()
  if (sourcePoly) allowed.add(sourcePoly)
  if (targetPoly) allowed.add(targetPoly)

  const result = findSleeveAndTriangles(cdt, source, target, allowed)
  if (!result) return false

  // Compute a focused bounding box around the sleeve
  const sleeveBB = Rectangle.mkPP(source, target)
  for (const t of result.sleeve) {
    sleeveBB.addRecSelf(new Rectangle({left: Math.min(t.Sites.item0.point.x, t.Sites.item1.point.x, t.Sites.item2.point.x),
      right: Math.max(t.Sites.item0.point.x, t.Sites.item1.point.x, t.Sites.item2.point.x),
      bottom: Math.min(t.Sites.item0.point.y, t.Sites.item1.point.y, t.Sites.item2.point.y),
      top: Math.max(t.Sites.item0.point.y, t.Sites.item1.point.y, t.Sites.item2.point.y)}))
  }
  sleeveBB.pad(sleeveBB.diagonal * 0.15)

  const curves: DebugCurve[] = []

  // 1. Nearby node boundaries and padded obstacles (only in view)
  for (const node of gg.nodesBreadthFirst) {
    if (!node.boundaryCurve) continue
    if (!sleeveBB.intersects(node.boundaryCurve.boundingBox)) continue
    if (node === edge.source || node === edge.target) continue
    // Actual node boundary
    curves.push(DebugCurve.mkDebugCurveTWCI(200, 1, 'DarkGray', node.boundaryCurve))
    // Padded obstacle
    const poly = nodeToPolyline.get(node)
    if (poly) {
      curves.push(DebugCurve.mkDebugCurveTWCILD(150, 0.5, 'Silver', poly, null, [3, 2]))
    }
  }

  // 2. Padded obstacles for source/target (thicker dashed)
  if (sourcePoly) {
    curves.push(DebugCurve.mkDebugCurveTWCILD(200, 1.2, 'IndianRed', sourcePoly, null, [4, 2]))
  }
  if (targetPoly) {
    curves.push(DebugCurve.mkDebugCurveTWCILD(200, 1.2, 'SteelBlue', targetPoly, null, [4, 2]))
  }

  // 3. Sleeve triangles (light blue outlines)
  for (const t of result.sleeve) {
    const tri = triangleToPolyline(t)
    curves.push(DebugCurve.mkDebugCurveTWCI(80, 0.5, 'CornflowerBlue', tri))
  }

  // 4. The routed edge curve (red, thick)
  if (edge.curve) {
    curves.push(DebugCurve.mkDebugCurveTWCI(255, 2.5, 'Red', edge.curve))
  }

  // 6. Source and target centers (small circles)
  const dotSize = 3
  curves.push(DebugCurve.mkDebugCurveTWCI(255, 2, 'Red',
    LineSegment.mkPP(source.add(new Point(-dotSize, 0)), source.add(new Point(dotSize, 0)))))
  curves.push(DebugCurve.mkDebugCurveTWCI(255, 2, 'Red',
    LineSegment.mkPP(source.add(new Point(0, -dotSize)), source.add(new Point(0, dotSize)))))
  curves.push(DebugCurve.mkDebugCurveTWCI(255, 2, 'Blue',
    LineSegment.mkPP(target.add(new Point(-dotSize, 0)), target.add(new Point(dotSize, 0)))))
  curves.push(DebugCurve.mkDebugCurveTWCI(255, 2, 'Blue',
    LineSegment.mkPP(target.add(new Point(0, -dotSize)), target.add(new Point(0, dotSize)))))

  // 7. Source/target node boundaries (thicker)
  if (edge.source.boundaryCurve)
    curves.push(DebugCurve.mkDebugCurveTWCI(255, 1.5, 'DarkRed', edge.source.boundaryCurve))
  if (edge.target.boundaryCurve)
    curves.push(DebugCurve.mkDebugCurveTWCI(255, 1.5, 'DarkBlue', edge.target.boundaryCurve))

  SvgDebugWriter.dumpDebugCurves(fileName, curves)
  return true
}

test('dump corridor routing figures for 10 random GOT edges', () => {
  const fpath = join(__dirname, '../data/JSONfiles/gameofthrones.json')
  const graphStr = fs.readFileSync(fpath, 'utf-8')
  const graph = parseJSON(JSON.parse(graphStr))
  const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  dg.createGeometry()
  const gg = <GeomGraph>GeomGraph.getGeom(graph)
  gg.layoutSettings = new MdsLayoutSettings()
  gg.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Corridor
  layoutGeomGraph(gg, null)

  const padding = 2
  const {cdt, nodeToPolyline} = buildCdtAndObstacles(gg, padding)

  // Collect all edges and pick 10 with reasonable path lengths (not too short, not too long)
  const edges = Array.from(gg.deepEdges).filter(e => e.curve != null)
  // Sort by distance and pick from the middle range
  edges.sort((a, b) => {
    const da = a.source.center.sub(a.target.center).length
    const db = b.source.center.sub(b.target.center).length
    return da - db
  })
  const mid = Math.floor(edges.length * 0.4)
  const selected = edges.slice(mid, mid + 10)

  const outDir = join(__dirname, '../../../../tmp/corridor_figs')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})

  for (let i = 0; i < selected.length; i++) {
    const edge = selected[i]
    const srcName = edge.edge.source.id
    const tgtName = edge.edge.target.id
    const fname = join(outDir, `edge_${i}_${srcName}_${tgtName}.svg`)
    const ok = dumpEdgeFigure(fname, edge, gg, cdt, nodeToPolyline)
    if (ok) {
      console.log(`Wrote ${fname}`)
    } else {
      console.log(`Failed to create figure for ${srcName} -> ${tgtName}`)
    }
  }
})

// --- Collapse before/after figure generation ---

type Diagonal = {left: Point; right: Point}
type FrontEdge = {source: CdtTriangle; edge: CdtEdge}

function sleeveToDiagonalsRaw(sleeve: FrontEdge[]): Diagonal[] {
  const diagonals: Diagonal[] = []
  for (const fe of sleeve) {
    const e = fe.edge
    const oppSite = fe.source.OppositeSite(e)
    if (Point.getTriangleOrientation(oppSite.point, e.lowerSite.point, e.upperSite.point) === TriangleOrientation.Counterclockwise) {
      diagonals.push({left: e.upperSite.point, right: e.lowerSite.point})
    } else {
      diagonals.push({right: e.upperSite.point, left: e.lowerSite.point})
    }
  }
  return diagonals
}

function sleeveToDiagonalsCollapsed(
  sleeve: FrontEdge[],
  sourcePoly: Polyline, sourceCenter: Point,
  targetPoly: Polyline, targetCenter: Point,
): Diagonal[] {
  function collapse(site: CdtSite): Point {
    if (site.Owner === sourcePoly) return sourceCenter
    if (site.Owner === targetPoly) return targetCenter
    return site.point
  }
  const diagonals: Diagonal[] = []
  for (const fe of sleeve) {
    const e = fe.edge
    const lowerPt = collapse(e.lowerSite)
    const upperPt = collapse(e.upperSite)
    if (lowerPt.equal(upperPt)) continue
    const oppSite = fe.source.OppositeSite(e)
    if (Point.getTriangleOrientation(oppSite.point, e.lowerSite.point, e.upperSite.point) === TriangleOrientation.Counterclockwise) {
      diagonals.push({left: upperPt, right: lowerPt})
    } else {
      diagonals.push({right: upperPt, left: lowerPt})
    }
  }
  return diagonals
}

// Simple funnel (same as in corridorRouter.ts)
function funnelFromDiagonals(source: Point, target: Point, diagonals: Diagonal[]): Point[] {
  if (diagonals.length === 0) return [source, target]
  // Use a simple approach: collect left/right chain vertices and return the path
  // For the figure we just need the waypoints, so use a simplified version
  const pts: Point[] = [source]
  for (const d of diagonals) {
    // Add the diagonal midpoint nearest to the previous point as a waypoint
    // (This is a rough approximation; for exact funnel we'd need the full algorithm)
  }
  pts.push(target)
  return pts
}

function findSleeveAsFrontEdges(
  cdt: Cdt, source: Point, target: Point, allowedPolys: Set<Polyline>,
): FrontEdge[] | null {
  const sourceTriangle = findContainingTriangle(cdt, source)
  if (!sourceTriangle) return null

  function triangleCentroid(t: CdtTriangle): Point {
    return new Point(
      (t.Sites.item0.point.x + t.Sites.item1.point.x + t.Sites.item2.point.x) / 3,
      (t.Sites.item0.point.y + t.Sites.item1.point.y + t.Sites.item2.point.y) / 3)
  }
  function triangleIsInsideObstacle(t: CdtTriangle): boolean {
    const o0 = t.Sites.item0.Owner as Polyline
    const o1 = t.Sites.item1.Owner as Polyline
    const o2 = t.Sites.item2.Owner as Polyline
    if (o0 == null || o1 == null || o2 == null) return false
    if (o0 !== o1 || o0 !== o2) return false
    return !allowedPolys.has(o0)
  }

  const gScore = new Map<CdtTriangle, number>()
  const cameFromEdge = new Map<CdtTriangle, CdtEdge | undefined>()
  const open: {f: number; g: number; t: CdtTriangle; seq: number}[] = []
  let seq = 0
  function heapPush(item: typeof open[0]) {
    open.push(item); let i = open.length - 1
    while (i > 0) { const p = (i-1)>>1; if (open[p].f < item.f || (open[p].f === item.f && open[p].seq < item.seq)) break; open[i] = open[p]; open[p] = item; i = p }
  }
  function heapPop() {
    const top = open[0]; const last = open.pop()!
    if (open.length > 0) { open[0] = last; let i = 0; while (true) { let s = i; const l = 2*i+1, r = 2*i+2; if (l < open.length && (open[l].f < open[s].f || (open[l].f === open[s].f && open[l].seq < open[s].seq))) s = l; if (r < open.length && (open[r].f < open[s].f || (open[r].f === open[s].f && open[r].seq < open[s].seq))) s = r; if (s === i) break; const tmp = open[i]; open[i] = open[s]; open[s] = tmp; i = s } }
    return top
  }

  const h0 = triangleCentroid(sourceTriangle).sub(target).length
  gScore.set(sourceTriangle, 0)
  cameFromEdge.set(sourceTriangle, undefined)
  heapPush({f: h0, g: 0, t: sourceTriangle, seq: seq++})

  while (open.length > 0) {
    const current = heapPop()
    const t = current.t
    if (current.g > (gScore.get(t) ?? Infinity)) continue
    if (t.containsPoint(target)) {
      // recover sleeve as FrontEdge[]
      const ret: FrontEdge[] = []
      for (let tr = t; tr !== sourceTriangle; ) {
        const e = cameFromEdge.get(tr)!
        tr = e.GetOtherTriangle_T(tr)!
        ret.push({source: tr, edge: e})
      }
      return ret.reverse()
    }
    const tC = triangleCentroid(t)
    const edgeInto = cameFromEdge.get(t)
    for (const e of t.Edges) {
      if (edgeInto !== undefined && e === edgeInto) continue
      const ot = e.GetOtherTriangle_T(t)
      if (ot == null) continue
      if (triangleIsInsideObstacle(ot)) continue
      const otC = triangleCentroid(ot)
      const tentG = current.g + tC.sub(otC).length
      const prev = gScore.get(ot)
      if (prev !== undefined && tentG >= prev) continue
      gScore.set(ot, tentG)
      cameFromEdge.set(ot, e)
      heapPush({f: tentG + otC.sub(target).length, g: tentG, t: ot, seq: seq++})
    }
  }
  return null
}

function dumpCombinedFigure(
  fileName: string,
  edge: GeomEdge,
  gg: GeomGraph,
  cdt: Cdt,
  nodeToPolyline: Map<GeomNode, Polyline>,
): boolean {
  const source = edge.source.center
  const target = edge.target.center
  const sourcePoly = nodeToPolyline.get(edge.source)!
  const targetPoly = nodeToPolyline.get(edge.target)!
  const allowed = new Set<Polyline>([sourcePoly, targetPoly])

  const sleeve = findSleeveAsFrontEdges(cdt, source, target, allowed)
  if (!sleeve || sleeve.length === 0) return false

  // Get the original (raw) diagonals
  const rawDiags = sleeveToDiagonalsRaw(sleeve)

  // Get the legally-collapsed route from corridorRoute
  const {corridorRoute} = require('../../../core/src/routing/corridorRouter')
  const untrimmedPoly = corridorRoute(cdt, source, target, sourcePoly, targetPoly)

  // Compute bounding box from sleeve triangles
  const bb = Rectangle.mkPP(source, target)
  for (const fe of sleeve) {
    for (const s of [fe.source.Sites.item0, fe.source.Sites.item1, fe.source.Sites.item2]) {
      bb.addRecSelf(Rectangle.mkPP(s.point, s.point))
    }
    const ot = fe.edge.GetOtherTriangle_T(fe.source)
    if (ot) for (const s of [ot.Sites.item0, ot.Sites.item1, ot.Sites.item2]) {
      bb.addRecSelf(Rectangle.mkPP(s.point, s.point))
    }
  }
  bb.pad(bb.diagonal * 0.12)

  const curves: DebugCurve[] = []

  // 1. Nearby padded obstacles only (no actual node boundaries)
  for (const node of gg.nodesBreadthFirst) {
    if (!node.boundaryCurve || !bb.intersects(node.boundaryCurve.boundingBox)) continue
    if (node === edge.source || node === edge.target) continue
    const poly = nodeToPolyline.get(node)
    if (poly) curves.push(DebugCurve.mkDebugCurveTWCI(180, 0.8, 'Gray', poly))
  }

  // 2. Original sleeve triangles (thin blue, dashed)
  const seen = new Set<CdtTriangle>()
  for (const fe of sleeve) {
    if (!seen.has(fe.source)) {
      seen.add(fe.source)
      curves.push(DebugCurve.mkDebugCurveTWCILD(150, 0.8, 'CornflowerBlue', triangleToPolyline(fe.source), null, [4, 3]))
    }
    const ot = fe.edge.GetOtherTriangle_T(fe.source)
    if (ot && !seen.has(ot)) {
      seen.add(ot)
      curves.push(DebugCurve.mkDebugCurveTWCILD(150, 0.8, 'CornflowerBlue', triangleToPolyline(ot), null, [4, 3]))
    }
  }

  // 3-4. Compute moved positions, then draw only changed diagonals
  {
    const allTris: CdtTriangle[] = []
    const seenTris = new Set<CdtTriangle>()
    for (const fe of sleeve) {
      if (!seenTris.has(fe.source)) { seenTris.add(fe.source); allTris.push(fe.source) }
      const ot = fe.edge.GetOtherTriangle_T(fe.source)
      if (ot && !seenTris.has(ot)) { seenTris.add(ot); allTris.push(ot) }
    }
    const siteAdj = new Map<CdtSite, {a: Point; b: Point}[]>()
    for (const t of allTris) {
      const sites = [t.Sites.item0, t.Sites.item1, t.Sites.item2]
      for (let i = 0; i < 3; i++) {
        const s = sites[i]
        let list = siteAdj.get(s)
        if (!list) { list = []; siteAdj.set(s, list) }
        list.push({a: sites[(i+1)%3].point, b: sites[(i+2)%3].point})
      }
    }
    const movedPos = new Map<CdtSite, Point>()
    for (const [site, tris] of siteAdj) {
      if (site.Owner === sourcePoly) {
        const dir = source.sub(site.point)
        let tMax = 1.0
        for (const {a, b} of tris) {
          const ex = b.x - a.x, ey = b.y - a.y
          const c0 = ex * (site.point.y - a.y) - ey * (site.point.x - a.x)
          const c1 = ex * dir.y - ey * dir.x
          if (c1 < -1e-12) tMax = Math.min(tMax, c0 / (-c1))
        }
        tMax = Math.max(0, Math.min(1, tMax * 0.99))
        if (tMax > 0.01) movedPos.set(site, site.point.add(dir.mul(tMax)))
      } else if (site.Owner === targetPoly) {
        const dir = target.sub(site.point)
        let tMax = 1.0
        for (const {a, b} of tris) {
          const ex = b.x - a.x, ey = b.y - a.y
          const c0 = ex * (site.point.y - a.y) - ey * (site.point.x - a.x)
          const c1 = ex * dir.y - ey * dir.x
          if (c1 < -1e-12) tMax = Math.min(tMax, c0 / (-c1))
        }
        tMax = Math.max(0, Math.min(1, tMax * 0.99))
        if (tMax > 0.01) movedPos.set(site, site.point.add(dir.mul(tMax)))
      }
    }

    // Draw ALL original diagonals (orange dashed)
    for (const fe of sleeve) {
      const e = fe.edge
      curves.push(DebugCurve.mkDebugCurveTWCILD(180, 1, 'Orange', LineSegment.mkPP(e.lowerSite.point, e.upperSite.point), null, [6, 3]))
    }

    // Draw moved diagonals (green solid) — only those that actually changed
    for (const fe of sleeve) {
      const e = fe.edge
      const movedLower = movedPos.get(e.lowerSite)
      const movedUpper = movedPos.get(e.upperSite)
      if (movedLower === undefined && movedUpper === undefined) continue
      const newLower = movedLower ?? e.lowerSite.point
      const newUpper = movedUpper ?? e.upperSite.point
      if (newLower.sub(newUpper).length > 1e-8) {
        curves.push(DebugCurve.mkDebugCurveTWCI(220, 1.5, 'Green', LineSegment.mkPP(newLower, newUpper)))
      }
    }
  }

  // 5. Source/target padded boundaries only
  curves.push(DebugCurve.mkDebugCurveTWCI(220, 1.2, 'IndianRed', sourcePoly))
  curves.push(DebugCurve.mkDebugCurveTWCI(220, 1.2, 'SteelBlue', targetPoly))

  SvgDebugWriter.dumpDebugCurves(fileName, curves)
  return true
}

test('dump combined sleeve figure for paper', () => {
  const fpath = join(__dirname, '../data/JSONfiles/gameofthrones.json')
  const graphStr = fs.readFileSync(fpath, 'utf-8')
  const graph = parseJSON(JSON.parse(graphStr))
  const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  dg.createGeometry()
  const gg = <GeomGraph>GeomGraph.getGeom(graph)
  gg.layoutSettings = new MdsLayoutSettings()
  gg.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Corridor
  layoutGeomGraph(gg, null)

  const padding = 2
  const {cdt, nodeToPolyline} = buildCdtAndObstacles(gg, padding)

  const edges = Array.from(gg.deepEdges).filter(e => e.curve != null)
  edges.sort((a, b) => a.source.center.sub(a.target.center).length - b.source.center.sub(b.target.center).length)

  const outDir = join(__dirname, '../../../../tmp/corridor_figs')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})

  // Generate 10 candidates from the middle range and pick the best
  const mid = Math.floor(edges.length * 0.4)
  const selected = edges.slice(mid, mid + 10)

  for (let i = 0; i < selected.length; i++) {
    const edge = selected[i]
    const srcName = edge.edge.source.id
    const tgtName = edge.edge.target.id
    const fname = join(outDir, `combined_${i}_${srcName}_${tgtName}.svg`)
    const ok = dumpCombinedFigure(fname, edge, gg, cdt, nodeToPolyline)
    if (ok) console.log(`Wrote ${fname}`)
  }
})
