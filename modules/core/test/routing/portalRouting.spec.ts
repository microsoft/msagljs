import {join} from 'path'
import * as fs from 'fs'
import {parseJSON} from '../../../parser/src/dotparser'
import {GeomGraph, GeomEdge, layoutGeomGraph, EdgeRoutingMode, MdsLayoutSettings, Point} from '../../../core/src'
import {DrawingGraph} from '../../../drawing/src'
import {Polyline} from '../../../core/src/math/geometry/polyline'
import {Rectangle} from '../../../core/src/math/geometry/rectangle'
import {Cdt} from '../../../core/src/routing/ConstrainedDelaunayTriangulation/Cdt'
import {InteractiveObstacleCalculator} from '../../../core/src/routing/interactiveObstacleCalculator'
import {
  findContainingTriangle,
  findPortalTriangles,
  routeCorridorEdges,
  routeCorridorEdgesHL,
  TriangleIndex,
} from '../../../core/src/routing/corridorRouter'
import {ContractionHierarchy, freeSpaceFilter} from '../../../core/src/routing/contractionHierarchy'
import {HubLabels} from '../../../core/src/routing/hubLabels'

function buildCdtFromGraph(gg: GeomGraph, padding: number) {
  const obstacles: Polyline[] = []
  const nodeToPolyline = new Map<unknown, Polyline>()
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

function layoutGot() {
  const fpath = join(__dirname, '../data/JSONfiles/gameofthrones.json')
  const graphStr = fs.readFileSync(fpath, 'utf-8')
  const graph = parseJSON(JSON.parse(graphStr))
  const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  dg.createGeometry()
  const gg = <GeomGraph>GeomGraph.getGeom(graph)
  gg.layoutSettings = new MdsLayoutSettings()
  gg.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.StraightLine
  layoutGeomGraph(gg, null)
  return gg
}

describe('Portal-based HL routing', () => {
  let gg: GeomGraph

  beforeAll(() => {
    gg = layoutGot()
  })

  test('portal triangles are found for each obstacle', () => {
    const {cdt, nodeToPolyline} = buildCdtFromGraph(gg, 2)
    const idx = new TriangleIndex(cdt)

    let totalPortals = 0
    let nodesWithPortals = 0
    for (const node of gg.nodesBreadthFirst) {
      const poly = nodeToPolyline.get(node) as Polyline | undefined
      if (!poly) continue
      const portals = findPortalTriangles(idx, poly)
      if (portals.length > 0) nodesWithPortals++
      totalPortals += portals.length

      // All portal triangles must be free-space
      for (const p of portals) {
        expect(idx.obstacleOwner[p]).toBeNull()
      }
      // All portal triangles must share an edge with the obstacle boundary
      for (const p of portals) {
        const t = idx.triangles[p]
        const count =
          (t.Sites.item0.Owner === poly ? 1 : 0) +
          (t.Sites.item1.Owner === poly ? 1 : 0) +
          (t.Sites.item2.Owner === poly ? 1 : 0)
        expect(count).toBeGreaterThanOrEqual(2)
      }
    }

    const nodeCount = Array.from(gg.nodesBreadthFirst).filter((n) => n.boundaryCurve).length
    console.log(`Portals: ${totalPortals} total, ${nodesWithPortals}/${nodeCount} nodes have portals`)
    expect(nodesWithPortals).toBe(nodeCount)
    expect(totalPortals).toBeGreaterThan(nodeCount)
  })

  test('portal triangles are reachable via free-space HL', () => {
    const {cdt, nodeToPolyline} = buildCdtFromGraph(gg, 2)
    const idx = new TriangleIndex(cdt)
    const ch = new ContractionHierarchy(cdt, freeSpaceFilter)
    const hl = new HubLabels(ch)

    const nodes = Array.from(gg.nodesBreadthFirst).filter((n) => n.boundaryCurve)
    let reachable = 0
    let tested = 0

    for (let i = 0; i < Math.min(10, nodes.length); i++) {
      const srcPoly = nodeToPolyline.get(nodes[i]) as Polyline
      const srcPortals = findPortalTriangles(idx, srcPoly)
      for (let j = i + 1; j < Math.min(i + 5, nodes.length); j++) {
        const tgtPoly = nodeToPolyline.get(nodes[j]) as Polyline
        const tgtPortals = findPortalTriangles(idx, tgtPoly)
        if (srcPortals.length === 0 || tgtPortals.length === 0) continue

        // Try at least one portal pair
        const srcCH = ch.getIndex(idx.triangles[srcPortals[0]])
        const tgtCH = ch.getIndex(idx.triangles[tgtPortals[0]])
        if (srcCH === undefined || tgtCH === undefined) continue

        tested++
        const dist = hl.query(srcCH, tgtCH)
        if (dist < Infinity) reachable++
      }
    }

    console.log(`Portal reachability: ${reachable}/${tested} pairs`)
    expect(reachable).toBeGreaterThan(0)
  })

  test('routeCorridorEdgesHL produces valid edge curves', () => {
    const edges = Array.from(gg.deepEdges)
    expect(edges.length).toBeGreaterThan(0)

    routeCorridorEdgesHL(gg, edges, null, 2)

    let routed = 0
    for (const edge of edges) {
      if (edge.curve != null) routed++
    }

    console.log(`HL routing: ${routed}/${edges.length} edges routed`)
    expect(routed).toBe(edges.length)
  })

  test('HL routing results are similar to Dijkstra routing', () => {
    // Route with Dijkstra
    const edgesDijkstra = Array.from(gg.deepEdges)
    routeCorridorEdges(gg, edgesDijkstra, null, 2)

    // Route with HL
    const edgesHL = Array.from(gg.deepEdges)
    routeCorridorEdgesHL(gg, edgesHL, null, 2)

    let compared = 0
    let similar = 0
    for (let i = 0; i < edgesDijkstra.length; i++) {
      const cd = edgesDijkstra[i].curve
      const ch = edgesHL[i].curve
      if (!cd || !ch) continue
      compared++

      // Both should route from approximately the same source to same target
      // Check that curve lengths are within 50% of each other
      const lenD = cd.length
      const lenH = ch.length
      const ratio = Math.max(lenD, lenH) / (Math.min(lenD, lenH) + 1e-10)
      if (ratio < 1.5) similar++
    }

    console.log(`Route comparison: ${similar}/${compared} edges have similar lengths`)
    // Most edges should have similar routes (allowing for different portal selection)
    expect(similar).toBeGreaterThan(compared * 0.5)
  })
})

describe('Portal-based HL routing on composers.json', () => {
  let gg: GeomGraph

  function layoutComposers() {
    const fpath = join(__dirname, '../data/JSONfiles/composers.json')
    const graphStr = fs.readFileSync(fpath, 'utf-8')
    const graph = parseJSON(JSON.parse(graphStr))
    const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
    dg.createGeometry()
    const g = <GeomGraph>GeomGraph.getGeom(graph)
    g.layoutSettings = new MdsLayoutSettings()
    g.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.StraightLine
    layoutGeomGraph(g, null)
    return g
  }

  beforeAll(() => {
    gg = layoutComposers()
  })

  test('HL routing routes all edges on composers graph', () => {
    const edges = Array.from(gg.deepEdges)
    const nodeCount = Array.from(gg.nodesBreadthFirst).filter((n) => n.boundaryCurve).length
    console.log(`Composers graph: ${nodeCount} nodes, ${edges.length} edges`)

    routeCorridorEdgesHL(gg, edges, null, 2)

    let routed = 0
    for (const edge of edges) {
      if (edge.curve != null) routed++
    }

    console.log(`HL routing: ${routed}/${edges.length} edges routed`)
    expect(routed).toBe(edges.length)
  })

  test('composers: HL vs Dijkstra comparison', () => {
    // Dijkstra
    const edgesD = Array.from(gg.deepEdges)
    const t0 = performance.now()
    routeCorridorEdges(gg, edgesD, null, 2)
    const t1 = performance.now()

    // HL
    const edgesH = Array.from(gg.deepEdges)
    const t2 = performance.now()
    routeCorridorEdgesHL(gg, edgesH, null, 2)
    const t3 = performance.now()

    let compared = 0
    let similar = 0
    for (let i = 0; i < edgesD.length; i++) {
      const cd = edgesD[i].curve
      const ch = edgesH[i].curve
      if (!cd || !ch) continue
      compared++
      const lenD = cd.length
      const lenH = ch.length
      const ratio = Math.max(lenD, lenH) / (Math.min(lenD, lenH) + 1e-10)
      if (ratio < 1.5) similar++
    }

    console.log(`Dijkstra: ${(t1 - t0).toFixed(1)}ms, HL: ${(t3 - t2).toFixed(1)}ms`)
    console.log(`Route comparison: ${similar}/${compared} edges have similar lengths`)
    expect(similar).toBeGreaterThan(compared * 0.5)
  })
})
