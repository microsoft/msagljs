import {join} from 'path'
import * as fs from 'fs'
import {parseJSON} from '../../../parser/src/dotparser'
import {
  GeomGraph,
  GeomNode,
  layoutGeomGraph,
  EdgeRoutingMode,
  Point,
  Polyline,
  Rectangle,
} from '../../../core/src'
import {DrawingGraph} from '../../../drawing/src'
import {Cdt} from '../../../core/src/routing/ConstrainedDelaunayTriangulation/Cdt'
import {InteractiveObstacleCalculator} from '../../../core/src/routing/interactiveObstacleCalculator'
import {
  findContainingTriangle,
  findSleeveAStar,
  sleeveToDiagonals,
  funnelFromDiagonals,
  Diagonal,
} from '../../../core/src/routing/corridorRouter'

function layoutGot() {
  const fpath = join(__dirname, '../data/JSONfiles/gameofthrones.json')
  const graphStr = fs.readFileSync(fpath, 'utf-8')
  const graph = parseJSON(JSON.parse(graphStr))
  const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  dg.createGeometry()
  const gg = <GeomGraph>GeomGraph.getGeom(graph)
  const {MdsLayoutSettings} = require('../../../core/src')
  gg.layoutSettings = new MdsLayoutSettings()
  gg.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Corridor
  layoutGeomGraph(gg, null)
  return gg
}

function buildCdt(gg: GeomGraph, padding: number) {
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
  return {cdt, nodeToPolyline}
}

test('MELISANDRE-STANNIS sleeve collapse from paper figure', () => {
  const gg = layoutGot()
  const {cdt, nodeToPolyline} = buildCdt(gg, 2)

  // Find the edge
  let sourceNode: GeomNode | null = null
  let targetNode: GeomNode | null = null
  for (const edge of gg.deepEdges) {
    if (edge.edge.source.id === 'MELISANDRE' && edge.edge.target.id === 'STANNIS') {
      sourceNode = edge.source
      targetNode = edge.target
      break
    }
    if (edge.edge.source.id === 'STANNIS' && edge.edge.target.id === 'MELISANDRE') {
      sourceNode = edge.target // MELISANDRE is source
      targetNode = edge.source
      break
    }
  }
  expect(sourceNode).not.toBeNull()
  expect(targetNode).not.toBeNull()

  const source = sourceNode!.center
  const target = targetNode!.center
  const sourcePoly = nodeToPolyline.get(sourceNode!)!
  const targetPoly = nodeToPolyline.get(targetNode!)!

  // Find sleeve
  const allowed = new Set<Polyline>([sourcePoly, targetPoly])
  const srcTri = findContainingTriangle(cdt, source)
  expect(srcTri).not.toBeNull()
  const sleeve = findSleeveAStar(srcTri!, target, allowed)
  expect(sleeve).not.toBeNull()
  expect(sleeve!.length).toBeGreaterThan(0)

  console.log(`Sleeve length: ${sleeve!.length} front edges`)

  // Raw diagonals (no collapse)
  const rawDiags = sleeveToDiagonals(sleeve!)
  console.log(`Raw diagonals: ${rawDiags.length}`)

  // Raw funnel path
  const rawPts = funnelFromDiagonals(source, target, rawDiags)
  let rawLen = 0
  for (let i = 1; i < rawPts.length; i++) rawLen += rawPts[i].sub(rawPts[i - 1]).length
  console.log(`Raw path: ${rawPts.length} waypoints, length ${rawLen.toFixed(1)}`)

  // Collapsed diagonals
  const cs = {poly: sourcePoly, center: source}
  const ct = {poly: targetPoly, center: target}
  const collDiags = sleeveToDiagonals(sleeve!, cs, ct)
  console.log(`Collapsed diagonals: ${collDiags.length}`)

  // Collapsed funnel path
  const collPts = funnelFromDiagonals(source, target, collDiags)
  let collLen = 0
  for (let i = 1; i < collPts.length; i++) collLen += collPts[i].sub(collPts[i - 1]).length
  console.log(`Collapsed path: ${collPts.length} waypoints, length ${collLen.toFixed(1)}`)

  // Collapse should not make the path longer
  console.log(`Ratio: ${(rawLen / collLen).toFixed(3)}`)
  expect(collLen).toBeLessThanOrEqual(rawLen + 1e-6)
  expect(collPts.length).toBeLessThanOrEqual(rawPts.length)

  // Verify no collapsed diagonal is degenerate (zero-length)
  for (const d of collDiags) {
    expect(d.left.sub(d.right).length).toBeGreaterThan(1e-8)
  }

  // Log the left and right chains for debugging
  const rawRight = rawDiags.map(d => `(${d.right.x.toFixed(1)},${d.right.y.toFixed(1)})`)
  const collRight = collDiags.map(d => `(${d.right.x.toFixed(1)},${d.right.y.toFixed(1)})`)
  console.log(`Raw right chain: ${rawRight.join(' → ')}`)
  console.log(`Coll right chain: ${collRight.join(' → ')}`)

  const rawLeft = rawDiags.map(d => `(${d.left.x.toFixed(1)},${d.left.y.toFixed(1)})`)
  const collLeft = collDiags.map(d => `(${d.left.x.toFixed(1)},${d.left.y.toFixed(1)})`)
  console.log(`Raw left chain: ${rawLeft.join(' → ')}`)
  console.log(`Coll left chain: ${collLeft.join(' → ')}`)
})
