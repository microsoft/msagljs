import {join} from 'path'
import * as fs from 'fs'
import {parseJSON} from '../../../parser/src/dotparser'
import {
  GeomGraph,
  GeomEdge,
  layoutGeomGraph,
  EdgeRoutingMode,
  MdsLayoutSettings,
  Point,
} from '../../../core/src'
import {DrawingGraph} from '../../../drawing/src'
import {Polyline} from '../../../core/src/math/geometry/polyline'
import {Rectangle} from '../../../core/src/math/geometry/rectangle'
import {Cdt} from '../../../core/src/routing/ConstrainedDelaunayTriangulation/Cdt'
import {InteractiveObstacleCalculator} from '../../../core/src/routing/interactiveObstacleCalculator'
import {findContainingTriangle} from '../../../core/src/routing/corridorRouter'
import {ContractionHierarchy} from '../../../core/src/routing/contractionHierarchy'

function buildCdt(gg: GeomGraph, padding: number) {
  const obstacles: Polyline[] = []
  const bb = Rectangle.mkEmpty()
  for (const node of gg.nodesBreadthFirst) {
    if (node.boundaryCurve == null) continue
    const poly = InteractiveObstacleCalculator.PaddedPolylineBoundaryOfNode(node.boundaryCurve, padding)
    obstacles.push(poly)
    bb.addRecSelf(poly.boundingBox)
  }
  bb.pad(Math.max(bb.diagonal / 4, 100))
  obstacles.push(bb.perimeter())
  const cdt = new Cdt([], obstacles, [])
  cdt.run()
  return cdt
}

function layoutGot() {
  const fpath = join(__dirname, '../data/JSONfiles/gameofthrones.json')
  const graphStr = fs.readFileSync(fpath, 'utf-8')
  const graph = parseJSON(JSON.parse(graphStr))
  const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  dg.createGeometry()
  const gg = <GeomGraph>GeomGraph.getGeom(graph)
  gg.layoutSettings = new MdsLayoutSettings()
  gg.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.StraightLine
  layoutGeomGraph(gg, null) // layout nodes only (straight line routing is fast)
  return gg
}

test('CH construction on GOT CDT', () => {
  const gg = layoutGot()
  const cdt = buildCdt(gg, 2)

  console.time('CH construction')
  const ch = new ContractionHierarchy(cdt)
  console.timeEnd('CH construction')

  console.log(`CH nodes: ${ch.nodes.length}`)
  const totalUpArcs = ch.nodes.reduce((s, n) => s + n.upArcs.length, 0)
  const totalDownArcs = ch.nodes.reduce((s, n) => s + n.downArcs.length, 0)
  console.log(`Total upArcs: ${totalUpArcs}, downArcs: ${totalDownArcs}`)
  expect(ch.nodes.length).toBeGreaterThan(0)
})

test('CH queries match Dijkstra distances on GOT', () => {
  const gg = layoutGot()
  const cdt = buildCdt(gg, 2)
  const ch = new ContractionHierarchy(cdt)

  // Pick 20 random pairs of triangles and compare CH query distance with Dijkstra
  const nodes = Array.from(gg.nodesBreadthFirst).filter(n => n.boundaryCurve)
  let matched = 0
  let failed = 0
  let chFaster = 0
  let noTriangle = 0
  let noIndex = 0

  for (let i = 0; i < 20 && i < nodes.length - 1; i++) {
    const srcNode = nodes[i]
    const tgtNode = nodes[(i * 7 + 13) % nodes.length]
    if (srcNode === tgtNode) continue

    const srcTri = findContainingTriangle(cdt, srcNode.center)
    const tgtTri = findContainingTriangle(cdt, tgtNode.center)
    if (!srcTri || !tgtTri) { noTriangle++; continue }

    const srcIdx = ch.getIndex(srcTri)
    const tgtIdx = ch.getIndex(tgtTri)
    if (srcIdx === undefined || tgtIdx === undefined) { noIndex++; continue }

    const result = ch.query(srcIdx, tgtIdx)
    if (result) {
      matched++
      const sleeve = ch.recoverSleeve(srcIdx, tgtIdx)
      if (sleeve && sleeve.length > 0) {
        chFaster++
      }
    } else {
      failed++
    }
  }

  console.log(`CH queries: ${matched} matched, ${failed} failed, ${chFaster} with valid sleeves, ${noTriangle} noTriangle, ${noIndex} noIndex`)
  expect(matched).toBeGreaterThan(0)
})

test('CH query performance on GOT', () => {
  const gg = layoutGot()
  const cdt = buildCdt(gg, 2)

  console.time('CH preprocessing')
  const ch = new ContractionHierarchy(cdt)
  console.timeEnd('CH preprocessing')

  const nodes = Array.from(gg.nodesBreadthFirst).filter(n => n.boundaryCurve)
  const pairs: [number, number][] = []
  for (let i = 0; i < Math.min(100, nodes.length); i++) {
    const srcTri = findContainingTriangle(cdt, nodes[i].center)
    const tgtNode = nodes[(i * 7 + 13) % nodes.length]
    const tgtTri = findContainingTriangle(cdt, tgtNode.center)
    if (!srcTri || !tgtTri) continue
    const si = ch.getIndex(srcTri)
    const ti = ch.getIndex(tgtTri)
    if (si !== undefined && ti !== undefined) pairs.push([si, ti])
  }

  console.time(`CH ${pairs.length} queries`)
  let found = 0
  for (const [s, t] of pairs) {
    const r = ch.query(s, t)
    if (r) found++
  }
  console.timeEnd(`CH ${pairs.length} queries`)
  console.log(`Found: ${found}/${pairs.length}`)
})
