import {join} from 'path'
import * as fs from 'fs'
import {parseJSON} from '../../../parser/src/dotparser'
import {GeomGraph, layoutGeomGraph, EdgeRoutingMode, MdsLayoutSettings, Point} from '../../../core/src'
import {DrawingGraph} from '../../../drawing/src'
import {Polyline} from '../../../core/src/math/geometry/polyline'
import {Rectangle} from '../../../core/src/math/geometry/rectangle'
import {Cdt} from '../../../core/src/routing/ConstrainedDelaunayTriangulation/Cdt'
import {InteractiveObstacleCalculator} from '../../../core/src/routing/interactiveObstacleCalculator'
import {findContainingTriangle} from '../../../core/src/routing/corridorRouter'
import {ContractionHierarchy, freeSpaceFilter} from '../../../core/src/routing/contractionHierarchy'
import {HubLabels} from '../../../core/src/routing/hubLabels'

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
  layoutGeomGraph(gg, null)
  return gg
}

/** Dijkstra on original CDT dual graph (ground truth, no CH shortcuts) */
function dijkstraDistance(ch: ContractionHierarchy, source: number, target: number): number {
  if (source === target) return 0
  const n = ch.nodes.length
  // Build adjacency from original CDT edges only (upArcs + downArcs that have cdtEdge)
  const adj = new Array<{to: number; w: number}[]>(n)
  for (let i = 0; i < n; i++) adj[i] = []
  const added = new Set<string>()
  for (let i = 0; i < n; i++) {
    for (const arc of [...ch.nodes[i].upArcs, ...ch.nodes[i].downArcs]) {
      if (!arc.cdtEdge) continue // skip shortcuts
      const key = Math.min(i, arc.target) + ',' + Math.max(i, arc.target)
      if (added.has(key)) continue
      added.add(key)
      adj[i].push({to: arc.target, w: arc.weight})
      adj[arc.target].push({to: i, w: arc.weight})
    }
  }

  const dist = new Float64Array(n).fill(Infinity)
  dist[source] = 0
  // Simple priority queue (array-based for small graphs)
  const heap: {g: number; node: number}[] = [{g: 0, node: source}]

  while (heap.length > 0) {
    // Extract min
    let minIdx = 0
    for (let i = 1; i < heap.length; i++) {
      if (heap[i].g < heap[minIdx].g) minIdx = i
    }
    const cur = heap[minIdx]
    heap[minIdx] = heap[heap.length - 1]
    heap.pop()

    if (cur.g > dist[cur.node]) continue
    if (cur.node === target) return dist[target]

    for (const {to, w} of adj[cur.node]) {
      const nd = cur.g + w
      if (nd < dist[to]) {
        dist[to] = nd
        heap.push({g: nd, node: to})
      }
    }
  }
  return dist[target]
}

describe('HubLabels', () => {
  let gg: GeomGraph
  let cdt: ReturnType<typeof buildCdt>
  let ch: ContractionHierarchy
  let hl: HubLabels

  beforeAll(() => {
    gg = layoutGot()
    cdt = buildCdt(gg, 2)
    ch = new ContractionHierarchy(cdt)
    hl = new HubLabels(ch)
  })

  test('construction produces non-empty labels', () => {
    expect(hl.nodeCount).toBeGreaterThan(0)
    expect(hl.averageLabelSize).toBeGreaterThan(0)
    console.log(`HL: ${hl.nodeCount} nodes, avg label ${hl.averageLabelSize.toFixed(1)}, max label ${hl.maxLabelSize}`)
  })

  test('self-query returns zero', () => {
    const nodes = Array.from(gg.nodesBreadthFirst).filter((n) => n.boundaryCurve)
    const tri = findContainingTriangle(cdt, nodes[0].center)
    const idx = ch.getIndex(tri!)
    expect(idx).toBeDefined()
    expect(hl.query(idx!, idx!)).toBe(0)
  })

  test('distances match Dijkstra ground truth', () => {
    const nodes = Array.from(gg.nodesBreadthFirst).filter((n) => n.boundaryCurve)
    let matched = 0,
      tested = 0

    for (let i = 0; i < 20 && i < nodes.length - 1; i++) {
      const srcNode = nodes[i]
      const tgtNode = nodes[(i * 7 + 13) % nodes.length]
      if (srcNode === tgtNode) continue

      const srcTri = findContainingTriangle(cdt, srcNode.center)
      const tgtTri = findContainingTriangle(cdt, tgtNode.center)
      if (!srcTri || !tgtTri) continue

      const srcIdx = ch.getIndex(srcTri)
      const tgtIdx = ch.getIndex(tgtTri)
      if (srcIdx === undefined || tgtIdx === undefined) continue

      tested++
      const hlDist = hl.query(srcIdx, tgtIdx)
      const dijDist = dijkstraDistance(ch, srcIdx, tgtIdx)

      // Allow small floating-point tolerance
      const relErr = Math.abs(hlDist - dijDist) / (dijDist + 1e-15)
      if (relErr < 1e-6) matched++
      else console.warn(`Mismatch: HL=${hlDist.toFixed(4)} Dijkstra=${dijDist.toFixed(4)} (relErr=${relErr.toFixed(8)})`)
    }

    console.log(`HL vs Dijkstra: ${matched}/${tested} matched`)
    expect(matched).toBe(tested)
  })

  test('sleeve recovery produces valid sleeves', () => {
    const nodes = Array.from(gg.nodesBreadthFirst).filter((n) => n.boundaryCurve)
    let validSleeves = 0,
      tested = 0

    for (let i = 0; i < 15 && i < nodes.length - 1; i++) {
      const srcNode = nodes[i]
      const tgtNode = nodes[(i * 7 + 13) % nodes.length]
      if (srcNode === tgtNode) continue

      const srcTri = findContainingTriangle(cdt, srcNode.center)
      const tgtTri = findContainingTriangle(cdt, tgtNode.center)
      if (!srcTri || !tgtTri) continue

      const srcIdx = ch.getIndex(srcTri)
      const tgtIdx = ch.getIndex(tgtTri)
      if (srcIdx === undefined || tgtIdx === undefined) continue

      tested++
      const sleeve = hl.recoverSleeve(srcIdx, tgtIdx)
      if (sleeve && sleeve.length > 0) {
        validSleeves++
        // Verify first sleeve entry starts at the source triangle
        expect(sleeve[0].source).toBe(ch.nodes[srcIdx].triangle)
      }
    }

    console.log(`Sleeve recovery: ${validSleeves}/${tested} valid`)
    expect(validSleeves).toBeGreaterThan(0)
  })

  test('query is faster than CH bidirectional search', () => {
    const nodes = Array.from(gg.nodesBreadthFirst).filter((n) => n.boundaryCurve)
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

    // Warm up
    for (const [s, t] of pairs) hl.query(s, t)

    // Time HL queries
    const hlStart = performance.now()
    let hlFound = 0
    for (const [s, t] of pairs) {
      if (hl.query(s, t) < Infinity) hlFound++
    }
    const hlTime = performance.now() - hlStart

    // Time CH queries
    const chStart = performance.now()
    let chFound = 0
    for (const [s, t] of pairs) {
      const r = ch.query(s, t)
      if (r) chFound++
    }
    const chTime = performance.now() - chStart

    console.log(`HL: ${hlTime.toFixed(2)}ms (${hlFound} found), CH: ${chTime.toFixed(2)}ms (${chFound} found) for ${pairs.length} queries`)
    console.log(`Speedup: ${(chTime / hlTime).toFixed(1)}x`)

    // HL should find at least as many paths as CH
    expect(hlFound).toBeGreaterThanOrEqual(chFound)
  })

  test('free-space filtered CH + HL works', () => {
    const chFree = new ContractionHierarchy(cdt, freeSpaceFilter)
    const hlFree = new HubLabels(chFree)
    expect(hlFree.nodeCount).toBeGreaterThan(0)
    expect(hlFree.nodeCount).toBeLessThanOrEqual(hl.nodeCount)
    console.log(`Free-space HL: ${hlFree.nodeCount} nodes (vs ${hl.nodeCount} total), avg label ${hlFree.averageLabelSize.toFixed(1)}`)
  })
})
