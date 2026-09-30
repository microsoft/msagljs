import * as fs from 'fs'
import * as path from 'path'
import {
  Edge,
  GeomEdge,
  GeomGraph,
  GeomNode,
  Graph,
  Node,
  CurveFactory,
  Point,
  MdsLayoutSettings,
  layoutGraphWithMds,
  layoutGeomGraph,
  EdgeRoutingMode,
} from '@msagl/core'
import {routeSleeveEdges} from '../../src/routing/sleeveRouter'
import {parseJSON} from '../../../parser/src/dotparser'
import {DrawingGraph} from '../../../drawing/src'

// Route-quality benchmark for the PacificVis 2027 paper: the straight
// center-to-center segment is a lower bound on ANY obstacle-avoiding route
// with the same endpoints, so (sleeve total)/(straight total) bounds the
// sleeve router's overhead over the visibility-graph optimum from above.
// Unlike the exact visibility comparison (feasible only on small graphs),
// this bound is cheap on the entire benchmark suite.
//
// Same corpus, geometry, and layout as maxPerTile.spec.ts: uniform
// 30x20 rounded-rectangle nodes, Pivot MDS. Routes are the production
// dijkstra-vc sleeve routes, untrimmed (center-to-center), padding 2.
//
// Disabled by default. Opt in with:
//   MSAGL_BENCH=1 NODE_OPTIONS="--max-old-space-size=16384" \
//     npx jest --testPathPattern=sleeveStraightBound --no-coverage

function resolveGraphsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../../../paper_msagljs/graphs'),
    path.resolve(__dirname, '../../../../graphs'),
  ]
  for (const p of candidates) if (fs.existsSync(p)) return p
  return candidates[0]
}
const graphsDir = resolveGraphsDir()
const resultsDir = fs.existsSync(path.resolve(__dirname, '../../../../../paper_msagljs'))
  ? path.resolve(__dirname, '../../../../../paper_msagljs')
  : path.resolve(__dirname, '../../../..')
const resultsTxt = path.join(resultsDir, 'sleeve_straightline_bound.txt')

// ---------------------------------------------------------------------------
// Parsers (same as maxPerTile.spec.ts)
// ---------------------------------------------------------------------------

function getOrAddNode(g: Graph, nodeMap: Map<string, Node>, id: string): Node {
  let n = nodeMap.get(id)
  if (!n) {
    n = new Node(id)
    g.addNode(n)
    nodeMap.set(id, n)
  }
  return n
}

function parseEdgeList(filePath: string): Graph {
  const content = fs.readFileSync(filePath, 'utf-8')
  const g = new Graph()
  const nodeMap = new Map<string, Node>()
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('%')) continue
    const parts = line.split(/\s+/).filter((s) => s.length > 0)
    if (parts.length < 2) continue
    const src = getOrAddNode(g, nodeMap, parts[0])
    const tgt = getOrAddNode(g, nodeMap, parts[1])
    if (src !== tgt) new Edge(src, tgt)
  }
  return g
}

function parseCSVEdges(filePath: string): Graph {
  const content = fs.readFileSync(filePath, 'utf-8')
  const g = new Graph()
  const nodeMap = new Map<string, Node>()
  const lines = content.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = line.split(',')
    if (parts.length < 2) continue
    const src = getOrAddNode(g, nodeMap, parts[0].trim())
    const tgt = getOrAddNode(g, nodeMap, parts[1].trim())
    if (src !== tgt) new Edge(src, tgt)
  }
  return g
}

function parseMatrixMarket(filePath: string): Graph {
  const content = fs.readFileSync(filePath, 'utf-8')
  const g = new Graph()
  const nodeMap = new Map<string, Node>()
  let headerSeen = false
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('%')) continue
    const parts = line.split(/\s+/)
    if (!headerSeen) {
      headerSeen = true
      continue
    }
    if (parts.length < 2) continue
    const src = getOrAddNode(g, nodeMap, parts[0])
    const tgt = getOrAddNode(g, nodeMap, parts[1])
    if (src !== tgt) new Edge(src, tgt)
  }
  return g
}

function parseSimpleJSON(filePath: string): Graph {
  const obj = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const g = new Graph()
  const nodeMap = new Map<string, Node>()
  for (const nd of obj.nodes ?? []) {
    getOrAddNode(g, nodeMap, String(nd.id))
  }
  for (const e of obj.edges ?? obj.links ?? []) {
    const s = String(e.source)
    const t = String(e.target)
    const src = getOrAddNode(g, nodeMap, s)
    const tgt = getOrAddNode(g, nodeMap, t)
    if (src !== tgt) new Edge(src, tgt)
  }
  return g
}

function createGeometry(g: Graph): GeomGraph {
  const gg = new GeomGraph(g)
  for (const n of g.shallowNodes) {
    const gn = new GeomNode(n)
    gn.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(30, 20, 3, 3, new Point(0, 0))
  }
  for (const e of g.deepEdges) {
    new GeomEdge(e)
  }
  return gg
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

interface Row {
  name: string
  nodes: number
  edges: number
  routed: number
  nullCurves: number
  straightTotal: number
  sleeveTotal: number
  overheadPct: number
  worstRatio: number
  worstPair: string
  straightRoutedPct: number
}

const EPS = 1e-6

function measure(name: string, gg: GeomGraph): Row {
  const edges = Array.from(gg.deepEdges)
  const t0 = performance.now()
  routeSleeveEdges(gg, edges, null, /*trimEdges*/ false, /*padding*/ 2)
  // eslint-disable-next-line no-console
  console.log(`[${name}] sleeve routing (untrimmed): ${(performance.now() - t0).toFixed(0)}ms`)

  let straightTotal = 0
  let sleeveTotal = 0
  let worstRatio = 0
  let worstPair = ''
  let straightRouted = 0
  let routed = 0
  let nullCurves = 0
  for (const e of edges) {
    const s = (e.source as GeomNode).center
    const t = (e.target as GeomNode).center
    const straight = s.sub(t).length
    if (e.curve == null) {
      nullCurves++
      continue
    }
    if (straight < EPS) continue // self-loop; excluded from both sums
    const len = e.curve.length
    routed++
    straightTotal += straight
    sleeveTotal += len
    const ratio = len / straight
    if (ratio <= 1 + EPS) straightRouted++
    if (ratio > worstRatio) {
      worstRatio = ratio
      worstPair = `${e.source.id} -> ${e.target.id}`
    }
  }
  return {
    name,
    nodes: gg.graph.shallowNodeCount,
    edges: edges.length,
    routed,
    nullCurves,
    straightTotal,
    sleeveTotal,
    overheadPct: (sleeveTotal / straightTotal - 1) * 100,
    worstRatio,
    worstPair,
    straightRoutedPct: (100 * straightRouted) / Math.max(routed, 1),
  }
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

interface GraphSpec {
  name: string
  parse: () => Graph
}

const graphs: GraphSpec[] = [
  {name: 'gameofthrones', parse: () => parseSimpleJSON(path.join(graphsDir, 'gameofthrones.json'))},
  {name: 'composers', parse: () => parseSimpleJSON(path.join(graphsDir, 'composers.json'))},
  {name: 'ca-GrQc', parse: () => parseEdgeList(path.join(graphsDir, 'ca-GrQc.txt'))},
  {name: 'ca-HepTh', parse: () => parseEdgeList(path.join(graphsDir, 'ca-HepTh.txt'))},
  {name: 'facebook_combined', parse: () => parseEdgeList(path.join(graphsDir, 'facebook_combined.txt'))},
  {name: 'ca-HepPh', parse: () => parseEdgeList(path.join(graphsDir, 'ca-HepPh.txt'))},
  {name: 'ca-CondMat', parse: () => parseEdgeList(path.join(graphsDir, 'ca-CondMat.txt'))},
  {name: 'deezer_europe', parse: () => parseCSVEdges(path.join(graphsDir, 'deezer_europe', 'deezer_europe_edges.csv'))},
  {name: 'delaunay_n15', parse: () => parseMatrixMarket(path.join(graphsDir, 'delaunay_n15', 'delaunay_n15.mtx'))},
]

const runBench = process.env.MSAGL_BENCH === '1'
;(runBench ? describe : describe.skip)('Sleeve vs straight-line lower bound', () => {
  const rows: Row[] = []

  afterAll(() => {
    const lines: string[] = []
    lines.push('Sleeve routes vs the straight-line lower bound (raw center-to-center')
    lines.push('polylines, untrimmed; production dijkstra-vc mode, padding 2).')
    lines.push('The straight segment lower-bounds every obstacle-avoiding route, so')
    lines.push('"overhead" bounds the gap to the visibility-graph optimum from above.')
    lines.push('')
    const header =
      'Graph'.padEnd(20) +
      'Nodes'.padStart(8) +
      'Edges'.padStart(9) +
      'Straight tot'.padStart(14) +
      'Sleeve tot'.padStart(13) +
      'Overhd%'.padStart(9) +
      'WorstRatio'.padStart(11) +
      'Straight%'.padStart(10)
    lines.push(header)
    lines.push('-'.repeat(header.length))
    for (const r of rows) {
      lines.push(
        r.name.padEnd(20) +
          r.nodes.toString().padStart(8) +
          r.edges.toString().padStart(9) +
          r.straightTotal.toFixed(0).padStart(14) +
          r.sleeveTotal.toFixed(0).padStart(13) +
          r.overheadPct.toFixed(2).padStart(9) +
          r.worstRatio.toFixed(3).padStart(11) +
          r.straightRoutedPct.toFixed(1).padStart(10),
      )
    }
    lines.push('')
    lines.push('Worst per-edge ratios:')
    for (const r of rows) {
      lines.push(`  ${r.name}: ${r.worstRatio.toFixed(3)} (${r.worstPair}); null curves: ${r.nullCurves}`)
    }
    fs.writeFileSync(resultsTxt, lines.join('\n') + '\n')
    // eslint-disable-next-line no-console
    console.log('Results written to ' + resultsTxt)
  })

  for (const spec of graphs) {
    test(spec.name, () => {
      const g = spec.parse()
      const gg = createGeometry(g)
      const settings = new MdsLayoutSettings()
      // Layout only; the untrimmed sleeve pass below does the routing.
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.None
      gg.layoutSettings = settings
      const t0 = performance.now()
      layoutGraphWithMds(gg, null)
      // eslint-disable-next-line no-console
      console.log(`[${spec.name}] layout: ${(performance.now() - t0).toFixed(0)}ms`)
      const row = measure(spec.name, gg)
      rows.push(row)
      // eslint-disable-next-line no-console
      console.log(
        `[${spec.name}] straight=${row.straightTotal.toFixed(0)} sleeve=${row.sleeveTotal.toFixed(0)} ` +
          `overhead=${row.overheadPct.toFixed(2)}% worst=${row.worstRatio.toFixed(3)} straight-routed=${row.straightRoutedPct.toFixed(1)}%`,
      )
      expect(row.nullCurves).toBe(0)
      expect(row.sleeveTotal).toBeGreaterThanOrEqual(row.straightTotal - 1)
    }, 7200000)
  }

  // Cross-check against the visibility-optimum run recorded in
  // sleeve_vs_visibility_benchmark.txt: same GoT setup (DrawingGraph
  // geometry with label sizes, MDS layout) must reproduce
  // straight-line total ~686614 and sleeve total ~714316.
  test('gameofthrones (DrawingGraph geometry, visibility cross-check)', () => {
    const fpath = path.join(__dirname, '../data/JSONfiles/gameofthrones.json')
    const graph = parseJSON(JSON.parse(fs.readFileSync(fpath, 'utf-8')))
    const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
    dg.createGeometry()
    const gg = <GeomGraph>GeomGraph.getGeom(graph)
    const settings = new MdsLayoutSettings()
    settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.None
    gg.layoutSettings = settings
    layoutGeomGraph(gg, null)
    const row = measure('gameofthrones-drawn', gg)
    rows.push(row)
    // eslint-disable-next-line no-console
    console.log(
      `[gameofthrones-drawn] straight=${row.straightTotal.toFixed(0)} sleeve=${row.sleeveTotal.toFixed(0)} ` +
        `overhead=${row.overheadPct.toFixed(2)}% worst=${row.worstRatio.toFixed(3)}`,
    )
    expect(row.nullCurves).toBe(0)
  }, 7200000)
})
