// Compare the three sleeve-routing strategies described in the GD 2026 paper:
//   astar       — per-edge A* on the CDT dual (no batched search).
//   dijkstra    — one Dijkstra tree per source endpoint (no vertex-cover swap).
//   dijkstra-vc — minimum-vertex-cover on the demand graph picks the Dijkstra
//                 root for each edge; this is the default of routeSleeveEdges.
//
// For each benchmark graph we run all three modes back-to-back on the same
// laid-out positions, time only the routing pass, and report
//   table 1: dijkstra-tree gain over pure A*           (astar  vs dijkstra),
//   table 2: vertex-cover gain over plain dijkstra-tree (dijkstra vs dijkstra-vc).
//
// Disabled by default. Run with:
//   MSAGL_BENCH=1 NODE_OPTIONS="--max-old-space-size=16384" \
//     npx jest --testPathPattern=benchmarkRoutingModes --no-coverage --runInBand

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
  Rectangle,
} from '@msagl/core'
import {EdgeRoutingMode} from '../../src/routing/EdgeRoutingMode'
import {routeSleeveEdges, SleeveRouteMode} from '../../src/routing/sleeveRouter'

const graphsDir = path.resolve(__dirname, '../../../../../paper_msagljs/graphs')
const resultsFile = path.resolve(__dirname, '../../../../../paper_msagljs/routing_modes_benchmark.txt')

// ---------- parsers (kept identical to benchmarkLoadingAllGraphs.spec.ts) ----

function makeGraph(addEdges: (g: Graph, getOrAdd: (id: string) => Node) => void): Graph {
  const g = new Graph()
  const nodeMap = new Map<string, Node>()
  const getOrAdd = (id: string): Node => {
    let n = nodeMap.get(id)
    if (!n) {
      n = new Node(id)
      g.addNode(n)
      nodeMap.set(id, n)
    }
    return n
  }
  addEdges(g, getOrAdd)
  return g
}

function parseEdgeList(filePath: string): Graph {
  const content = fs.readFileSync(filePath, 'utf-8')
  return makeGraph((_g, getOrAdd) => {
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#') || line.startsWith('%')) continue
      const parts = line.split(/\s+/).filter((s) => s.length > 0)
      if (parts.length < 2) continue
      const src = getOrAdd(parts[0])
      const tgt = getOrAdd(parts[1])
      if (src !== tgt) new Edge(src, tgt)
    }
  })
}

function parseCSVEdges(filePath: string): Graph {
  const content = fs.readFileSync(filePath, 'utf-8')
  return makeGraph((_g, getOrAdd) => {
    const lines = content.split('\n')
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const parts = line.split(',')
      if (parts.length < 2) continue
      const src = getOrAdd(parts[0].trim())
      const tgt = getOrAdd(parts[1].trim())
      if (src !== tgt) new Edge(src, tgt)
    }
  })
}

function parseMatrixMarket(filePath: string): Graph {
  const content = fs.readFileSync(filePath, 'utf-8')
  return makeGraph((_g, getOrAdd) => {
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
      const src = getOrAdd(parts[0])
      const tgt = getOrAdd(parts[1])
      if (src !== tgt) new Edge(src, tgt)
    }
  })
}

function parseJsonNodesEdges(filePath: string): Graph {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return makeGraph((_g, getOrAdd) => {
    for (const node of data.nodes ?? []) {
      getOrAdd(String(node.id))
    }
    const edgeList = data.edges ?? data.links ?? []
    for (const e of edgeList) {
      const src = getOrAdd(String(e.source))
      const tgt = getOrAdd(String(e.target))
      if (src !== tgt) new Edge(src, tgt)
    }
  })
}

// ---------- geometry / layout helpers ----------

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

function collectGeomEdges(gg: GeomGraph): GeomEdge[] {
  const out: GeomEdge[] = []
  for (const e of gg.deepEdges) out.push(e)
  return out
}

// ---------- console.time interception ----------

type PhaseTimings = {[label: string]: number}
function withPhaseCapture<T>(captured: PhaseTimings, fn: () => T): T {
  const realTime = console.time
  const realTimeEnd = console.timeEnd
  const starts = new Map<string, number>()
  console.time = (label?: string) => {
    if (label != null) starts.set(label, performance.now())
  }
  console.timeEnd = (label?: string) => {
    if (label == null) return
    const s = starts.get(label)
    if (s == null) return
    starts.delete(label)
    const dt = performance.now() - s
    captured[label] = (captured[label] ?? 0) + dt
  }
  try {
    return fn()
  } finally {
    console.time = realTime
    console.timeEnd = realTimeEnd
  }
}

// ---------- benchmark driver ----------

type ModeRow = {
  name: string
  nodes: number
  edges: number
  // dijkstra-tree counts
  distinctSources: number
  vcRoots: number
  // CDT phase (constant per graph; we report the median across modes)
  cdtMs: number
  // routing-only ms per mode (sleeve-search; excludes CDT)
  astarMs: number
  dijkstraMs: number
  dijkstraVcMs: number
}

function timeOneRouting(
  gg: GeomGraph,
  mode: SleeveRouteMode,
  padding: number,
): {cdtMs: number; routingMs: number} {
  const captured: PhaseTimings = {}
  const edges = collectGeomEdges(gg)
  withPhaseCapture(captured, () => {
    routeSleeveEdges(gg, edges, null, true, padding, undefined, undefined, 0, undefined, false, mode)
  })
  return {
    cdtMs: captured['SleeveRouter CDT'] ?? 0,
    routingMs: captured['SleeveRouter routing'] ?? 0,
  }
}

function countDistinctSources(gg: GeomGraph): {distinct: number; vc: number} {
  const sources = new Set<unknown>()
  const incident = new Map<unknown, number>()
  const edges: {s: unknown; t: unknown}[] = []
  for (const e of gg.deepEdges) {
    sources.add(e.source)
    edges.push({s: e.source, t: e.target})
    incident.set(e.source, (incident.get(e.source) ?? 0) + 1)
    incident.set(e.target, (incident.get(e.target) ?? 0) + 1)
  }
  // Greedy max-degree vertex cover on the demand multigraph
  // (matches chooseDijkstraRoots semantics modulo bucket ties).
  const remaining = new Set<{s: unknown; t: unknown}>(edges)
  const deg = new Map<unknown, number>(incident)
  let vc = 0
  while (remaining.size > 0) {
    let best: unknown = null
    let bestDeg = -1
    for (const [n, d] of deg) {
      if (d > bestDeg) {
        bestDeg = d
        best = n
      }
    }
    if (best == null || bestDeg <= 0) break
    vc++
    deg.set(best, 0)
    for (const e of Array.from(remaining)) {
      if (e.s === best || e.t === best) {
        remaining.delete(e)
        const other = e.s === best ? e.t : e.s
        deg.set(other, (deg.get(other) ?? 1) - 1)
      }
    }
  }
  return {distinct: sources.size, vc}
}

function benchmark(name: string, parse: () => Graph): ModeRow {
  const g = parse()
  const nodes = g.shallowNodeCount
  const edges = g.edgeCount

  // Geometry + layout WITHOUT edge routing — we time the routing pass ourselves.
  const gg = createGeometry(g)
  const settings = new MdsLayoutSettings()
  settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.None
  gg.layoutSettings = settings
  layoutGraphWithMds(gg, null)

  const {distinct, vc} = countDistinctSources(gg)
  const padding = 2

  // Run all three modes back-to-back on the same laid-out positions.
  // Order: astar (slowest) first to get a thermal-warm baseline; then dijkstra,
  // then dijkstra-vc. Each call is independent (sleeve router rebuilds the CDT
  // each time and resets its scratch arrays internally).
  const a = timeOneRouting(gg, 'astar', padding)
  const d = timeOneRouting(gg, 'dijkstra', padding)
  const v = timeOneRouting(gg, 'dijkstra-vc', padding)

  // CDT phase is the same logic across modes; report the median to dampen noise.
  const cdts = [a.cdtMs, d.cdtMs, v.cdtMs].sort((x, y) => x - y)
  const cdtMs = cdts[1]

  return {
    name,
    nodes,
    edges,
    distinctSources: distinct,
    vcRoots: vc,
    cdtMs,
    astarMs: a.routingMs,
    dijkstraMs: d.routingMs,
    dijkstraVcMs: v.routingMs,
  }
}

// ---------- formatting ----------

function fmtSec(ms: number): string {
  if (ms >= 60_000) return (ms / 1000).toFixed(1) + 's'
  if (ms >= 1000) return (ms / 1000).toFixed(2) + 's'
  return (ms / 1000).toFixed(3) + 's'
}

function pct(faster: number, slower: number): string {
  if (slower <= 0) return '—'
  const gain = ((slower - faster) / slower) * 100
  return (gain >= 0 ? '+' : '') + gain.toFixed(1) + '%'
}

function pad(s: string, w: number, right = false): string {
  return right ? s.padEnd(w) : s.padStart(w)
}

function renderTable1(rows: ModeRow[]): string[] {
  const lines: string[] = []
  lines.push('Table 1: Dijkstra-tree gain over pure A*')
  const headers = [
    {title: 'Graph', w: 20, right: true},
    {title: '|V|', w: 8},
    {title: '|E|', w: 9},
    {title: 'A* (s)', w: 10},
    {title: 'Dijk (s)', w: 10},
    {title: 'Speedup', w: 10},
  ]
  const headerLine = headers.map((h) => pad(h.title, h.w, h.right)).join('  ')
  lines.push(headerLine)
  lines.push('-'.repeat(headerLine.length))
  for (const r of rows) {
    lines.push(
      [
        pad(r.name, headers[0].w, true),
        pad(String(r.nodes), headers[1].w),
        pad(String(r.edges), headers[2].w),
        pad(fmtSec(r.astarMs), headers[3].w),
        pad(fmtSec(r.dijkstraMs), headers[4].w),
        pad(pct(r.dijkstraMs, r.astarMs), headers[5].w),
      ].join('  '),
    )
  }
  return lines
}

function renderTable2(rows: ModeRow[]): string[] {
  const lines: string[] = []
  lines.push('Table 2: Vertex-cover gain over plain Dijkstra-tree')
  const headers = [
    {title: 'Graph', w: 20, right: true},
    {title: 'Sources', w: 9},
    {title: 'VC roots', w: 10},
    {title: 'Dijk (s)', w: 10},
    {title: 'Dijk+VC (s)', w: 12},
    {title: 'Speedup', w: 10},
  ]
  const headerLine = headers.map((h) => pad(h.title, h.w, h.right)).join('  ')
  lines.push(headerLine)
  lines.push('-'.repeat(headerLine.length))
  for (const r of rows) {
    lines.push(
      [
        pad(r.name, headers[0].w, true),
        pad(String(r.distinctSources), headers[1].w),
        pad(String(r.vcRoots), headers[2].w),
        pad(fmtSec(r.dijkstraMs), headers[3].w),
        pad(fmtSec(r.dijkstraVcMs), headers[4].w),
        pad(pct(r.dijkstraVcMs, r.dijkstraMs), headers[5].w),
      ].join('  '),
    )
  }
  return lines
}

// ---------- LaTeX output (booktabs, matches Table 2 of gd2026.tex) ----------

function fmtSecTex(ms: number): string {
  if (ms >= 60_000) return (ms / 1000).toFixed(1)
  if (ms >= 1000) return (ms / 1000).toFixed(2)
  return (ms / 1000).toFixed(3)
}

function texEscape(name: string): string {
  return name.replace(/_/g, '\\_')
}

function renderLatexTable1(rows: ModeRow[]): string[] {
  const lines: string[] = []
  lines.push('% Table 1 (LaTeX, booktabs): Dijkstra-tree vs pure A*')
  lines.push('\\begin{tabular}{lrrrrr}')
  lines.push('\\toprule')
  lines.push('Graph & $|V|$ & $|E|$ & A* (s) & Dijk.\\ (s) & Speedup \\\\')
  lines.push('\\midrule')
  for (const r of rows) {
    lines.push(
      `${texEscape(r.name)} & ${r.nodes} & ${r.edges} & ${fmtSecTex(r.astarMs)} & ${fmtSecTex(r.dijkstraMs)} & ${pct(
        r.dijkstraMs,
        r.astarMs,
      )} \\\\`,
    )
  }
  lines.push('\\bottomrule')
  lines.push('\\end{tabular}')
  return lines
}

function renderLatexTable2(rows: ModeRow[]): string[] {
  const lines: string[] = []
  lines.push('% Table 2 (LaTeX, booktabs): Vertex-cover vs plain Dijkstra-tree')
  lines.push('\\begin{tabular}{lrrrrr}')
  lines.push('\\toprule')
  lines.push('Graph & Sources & VC roots & Dijk.\\ (s) & Dijk.+VC (s) & Speedup \\\\')
  lines.push('\\midrule')
  for (const r of rows) {
    lines.push(
      `${texEscape(r.name)} & ${r.distinctSources} & ${r.vcRoots} & ${fmtSecTex(r.dijkstraMs)} & ${fmtSecTex(
        r.dijkstraVcMs,
      )} & ${pct(r.dijkstraVcMs, r.dijkstraMs)} \\\\`,
    )
  }
  lines.push('\\bottomrule')
  lines.push('\\end{tabular}')
  return lines
}

// ---------- spec ----------

const runBench = process.env.MSAGL_BENCH === '1'
;(runBench ? describe : describe.skip)('Benchmark sleeve routing modes (A* / Dijkstra / Dijkstra+VC)', () => {
  const graphs: {name: string; parse: () => Graph; file: string}[] = [
    {
      name: 'gameofthrones',
      file: path.join(graphsDir, 'gameofthrones.json'),
      parse: () => parseJsonNodesEdges(path.join(graphsDir, 'gameofthrones.json')),
    },
    {
      name: 'composers',
      file: path.join(graphsDir, 'composers.json'),
      parse: () => parseJsonNodesEdges(path.join(graphsDir, 'composers.json')),
    },
    {
      name: 'ca-GrQc',
      file: path.join(graphsDir, 'ca-GrQc.txt'),
      parse: () => parseEdgeList(path.join(graphsDir, 'ca-GrQc.txt')),
    },
    {
      name: 'facebook_combined',
      file: path.join(graphsDir, 'facebook_combined.txt'),
      parse: () => parseEdgeList(path.join(graphsDir, 'facebook_combined.txt')),
    },
    {
      name: 'ca-HepTh',
      file: path.join(graphsDir, 'ca-HepTh.txt'),
      parse: () => parseEdgeList(path.join(graphsDir, 'ca-HepTh.txt')),
    },
    {
      name: 'ca-HepPh',
      file: path.join(graphsDir, 'ca-HepPh.txt'),
      parse: () => parseEdgeList(path.join(graphsDir, 'ca-HepPh.txt')),
    },
    {
      name: 'ca-CondMat',
      file: path.join(graphsDir, 'ca-CondMat.txt'),
      parse: () => parseEdgeList(path.join(graphsDir, 'ca-CondMat.txt')),
    },
    {
      name: 'deezer_europe',
      file: path.join(graphsDir, 'deezer_europe', 'deezer_europe_edges.csv'),
      parse: () => parseCSVEdges(path.join(graphsDir, 'deezer_europe', 'deezer_europe_edges.csv')),
    },
    {
      name: 'delaunay_n15',
      file: path.join(graphsDir, 'delaunay_n15', 'delaunay_n15.mtx'),
      parse: () => parseMatrixMarket(path.join(graphsDir, 'delaunay_n15', 'delaunay_n15.mtx')),
    },
  ]

  const rows: ModeRow[] = []
  const log: string[] = []
  const out = (msg: string) => {
    console.log(msg)
    log.push(msg)
  }

  for (const graph of graphs) {
    if (!fs.existsSync(graph.file)) {
      it.skip(`${graph.name} (file not found: ${graph.file})`, () => {})
      continue
    }
    test(graph.name, () => {
      const r = benchmark(graph.name, graph.parse)
      rows.push(r)
      out(
        `${r.name}: |V|=${r.nodes} |E|=${r.edges}  ` +
          `astar=${fmtSec(r.astarMs)}  dijk=${fmtSec(r.dijkstraMs)}  dijk+vc=${fmtSec(r.dijkstraVcMs)}  ` +
          `(sources=${r.distinctSources}  vc=${r.vcRoots})`,
      )
    }, 7_200_000)
  }

  afterAll(() => {
    if (rows.length === 0) return
    out('')
    out('================================================================')
    out('  Routing-modes benchmark — sleeve search times only (CDT excluded)')
    out('================================================================')
    out('')
    for (const line of renderTable1(rows)) out(line)
    out('')
    for (const line of renderTable2(rows)) out(line)
    out('')
    for (const line of renderLatexTable1(rows)) out(line)
    out('')
    for (const line of renderLatexTable2(rows)) out(line)
    out('')

    fs.writeFileSync(resultsFile, log.join('\n') + '\n')
    out(`Results written to ${resultsFile}`)
  })
})
