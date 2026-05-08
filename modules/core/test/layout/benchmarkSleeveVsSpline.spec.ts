// Compare the sleeve router (CDT + funnel) against the spanner-based
// spline router on a shared corpus.
//
// For each benchmark graph we:
//   1. parse it,
//   2. run layoutGraphWithMds twice on fresh geometry: once with
//      EdgeRoutingMode.Sleeve and once with EdgeRoutingMode.Spline,
//   3. record total wall-clock and total edge length for each router.
//
// MDS is deterministic (seeded) and runs in both passes, so its cost
// cancels out when comparing the two routers.  We report the full
// layout+routing wall-clock for each pass — that is what end users see.
//
// Disabled by default. Run with:
//   MSAGL_BENCH=1 NODE_OPTIONS="--max-old-space-size=16384" \
//     npx jest --testPathPattern=benchmarkSleeveVsSpline --no-coverage --runInBand
//
// Memory note: the spanner-based spline router does not do an n^2
// construction; it builds a cone-spanner and routes shortest paths on it.
// The Node test runner has access to up to --max-old-space-size GB, so we
// can run graphs that would not fit under Chrome's 4 GB cap.

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
} from '@msagl/core'
import {EdgeRoutingMode} from '../../src/routing/EdgeRoutingMode'

const graphsDir = path.resolve(__dirname, '../../../../../paper_msagljs/graphs')
const resultsFile = path.resolve(__dirname, '../../../../../paper_msagljs/sleeve_vs_spline_benchmark.txt')

// ---------- parsers (shared with the other benchmarks) ----------

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

// ---------- geometry helpers ----------

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

function totalEdgeLength(gg: GeomGraph): {total: number; routed: number; missing: number} {
  let total = 0
  let routed = 0
  let missing = 0
  for (const e of gg.deepEdges) {
    if (e.curve == null) {
      missing++
      continue
    }
    total += e.curve.length
    routed++
  }
  return {total, routed, missing}
}

// ---------- timing ----------

type RunResult = {
  ms: number
  totalLength: number
  routedEdges: number
  missingEdges: number
  ok: boolean
  errMsg?: string
}

type Row = {
  name: string
  nodes: number
  edges: number
  sleeve: RunResult
  spline: RunResult
}

function runOne(parse: () => Graph, mode: EdgeRoutingMode): RunResult {
  const g = parse()
  const gg = createGeometry(g)
  const settings = new MdsLayoutSettings()
  settings.edgeRoutingSettings.EdgeRoutingMode = mode
  gg.layoutSettings = settings

  const t0 = performance.now()
  let ok = true
  let errMsg: string | undefined
  try {
    layoutGraphWithMds(gg, null)
  } catch (err) {
    ok = false
    errMsg = (err as Error).message
    console.warn(`  ${EdgeRoutingMode[mode]} failed:`, errMsg)
  }
  const ms = performance.now() - t0
  const len = totalEdgeLength(gg)
  return {
    ms,
    totalLength: len.total,
    routedEdges: len.routed,
    missingEdges: len.missing,
    ok,
    errMsg,
  }
}

function benchmark(name: string, parse: () => Graph): Row {
  const probe = parse()
  const nodes = probe.shallowNodeCount
  const edges = probe.edgeCount

  // Run sleeve first (the proposed router), then spline. Each pass parses
  // and lays out the graph from scratch so the two routers see the same
  // randomly-seeded MDS positions.
  const sleeve = runOne(parse, EdgeRoutingMode.Sleeve)
  const spline = runOne(parse, EdgeRoutingMode.Spline)

  return {name, nodes, edges, sleeve, spline}
}

// ---------- formatting ----------

function fmtSec(ms: number): string {
  if (ms >= 60_000) return (ms / 1000).toFixed(1) + 's'
  if (ms >= 1000) return (ms / 1000).toFixed(2) + 's'
  return (ms / 1000).toFixed(3) + 's'
}

function fmtLen(L: number): string {
  if (L >= 1e7) return (L / 1e6).toFixed(2) + 'M'
  if (L >= 1e4) return (L / 1e3).toFixed(1) + 'k'
  return L.toFixed(0)
}

function ratio(a: number, b: number, aOk: boolean, bOk: boolean): string {
  if (!aOk || !bOk || a <= 0) return '—'
  return (b / a).toFixed(2) + '×'
}

function pad(s: string, w: number, right = false): string {
  return right ? s.padEnd(w) : s.padStart(w)
}

function timeCell(r: RunResult): string {
  return r.ok ? fmtSec(r.ms) : 'failed'
}

function lenCell(r: RunResult): string {
  if (!r.ok) return 'failed'
  return fmtLen(r.totalLength) + (r.missingEdges > 0 ? ` (-${r.missingEdges})` : '')
}

function renderTimeTable(rows: Row[]): string[] {
  const lines: string[] = []
  lines.push('Time (full layoutGraphWithMds: MDS + routing)')
  const headers = [
    {title: 'Graph', w: 22, right: true},
    {title: '|V|', w: 8},
    {title: '|E|', w: 9},
    {title: 'Sleeve', w: 10},
    {title: 'Spline', w: 10},
    {title: 'Spline/Sleeve', w: 14},
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
        pad(timeCell(r.sleeve), headers[3].w),
        pad(timeCell(r.spline), headers[4].w),
        pad(ratio(r.sleeve.ms, r.spline.ms, r.sleeve.ok, r.spline.ok), headers[5].w),
      ].join('  '),
    )
  }
  return lines
}

function renderLengthTable(rows: Row[]): string[] {
  const lines: string[] = []
  lines.push('Total edge length (sum of curve arc-lengths over routed edges)')
  const headers = [
    {title: 'Graph', w: 22, right: true},
    {title: '|V|', w: 8},
    {title: '|E|', w: 9},
    {title: 'Sleeve', w: 14},
    {title: 'Spline', w: 14},
    {title: 'Spline/Sleeve', w: 14},
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
        pad(lenCell(r.sleeve), headers[3].w),
        pad(lenCell(r.spline), headers[4].w),
        pad(ratio(r.sleeve.totalLength, r.spline.totalLength, r.sleeve.ok, r.spline.ok), headers[5].w),
      ].join('  '),
    )
  }
  lines.push('')
  lines.push("Note: parenthesized -K means K edges have curve == null (routing missed them); their length is excluded from the sum.")
  return lines
}

// ---------- LaTeX output (booktabs) ----------

function fmtSecTex(ms: number): string {
  if (ms >= 60_000) return (ms / 1000).toFixed(1)
  if (ms >= 1000) return (ms / 1000).toFixed(2)
  return (ms / 1000).toFixed(3)
}

function fmtLenTex(L: number): string {
  if (L >= 1e7) return (L / 1e6).toFixed(2) + 'M'
  if (L >= 1e4) return (L / 1e3).toFixed(1) + 'k'
  return L.toFixed(0)
}

function texEscape(name: string): string {
  return name.replace(/_/g, '\\_')
}

function texCell(r: RunResult, value: string): string {
  return r.ok ? value : '\\textit{failed}'
}

function renderLatexTimeTable(rows: Row[]): string[] {
  const lines: string[] = []
  lines.push('% Time (LaTeX, booktabs): full layoutGraphWithMds wall-clock')
  lines.push('\\begin{tabular}{lrrrrr}')
  lines.push('\\toprule')
  lines.push('Graph & $|V|$ & $|E|$ & Sleeve (s) & Spline (s) & Spline/Sleeve \\\\')
  lines.push('\\midrule')
  for (const r of rows) {
    lines.push(
      `${texEscape(r.name)} & ${r.nodes} & ${r.edges} & ${texCell(r.sleeve, fmtSecTex(r.sleeve.ms))} & ${texCell(
        r.spline,
        fmtSecTex(r.spline.ms),
      )} & ${ratio(r.sleeve.ms, r.spline.ms, r.sleeve.ok, r.spline.ok)} \\\\`,
    )
  }
  lines.push('\\bottomrule')
  lines.push('\\end{tabular}')
  return lines
}

function renderLatexLengthTable(rows: Row[]): string[] {
  const lines: string[] = []
  lines.push('% Total edge length (LaTeX, booktabs)')
  lines.push('\\begin{tabular}{lrrrrr}')
  lines.push('\\toprule')
  lines.push('Graph & $|V|$ & $|E|$ & Sleeve & Spline & Spline/Sleeve \\\\')
  lines.push('\\midrule')
  for (const r of rows) {
    lines.push(
      `${texEscape(r.name)} & ${r.nodes} & ${r.edges} & ${texCell(r.sleeve, fmtLenTex(r.sleeve.totalLength))} & ${texCell(
        r.spline,
        fmtLenTex(r.spline.totalLength),
      )} & ${ratio(r.sleeve.totalLength, r.spline.totalLength, r.sleeve.ok, r.spline.ok)} \\\\`,
    )
  }
  lines.push('\\bottomrule')
  lines.push('\\end{tabular}')
  return lines
}

// ---------- spec ----------

const runBench = process.env.MSAGL_BENCH === '1'
;(runBench ? describe : describe.skip)('Benchmark sleeve vs spline routing (time and total edge length)', () => {
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

  const rows: Row[] = []
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
    test(
      graph.name,
      () => {
        const r = benchmark(graph.name, graph.parse)
        rows.push(r)
        out(
          `${r.name}: |V|=${r.nodes} |E|=${r.edges}  ` +
            `sleeve=${timeCell(r.sleeve)}/${lenCell(r.sleeve)}  ` +
            `spline=${timeCell(r.spline)}/${lenCell(r.spline)}  ` +
            `(time ${ratio(r.sleeve.ms, r.spline.ms, r.sleeve.ok, r.spline.ok)}, ` +
            `length ${ratio(r.sleeve.totalLength, r.spline.totalLength, r.sleeve.ok, r.spline.ok)})`,
        )
      },
      7_200_000,
    )
  }

  afterAll(() => {
    if (rows.length === 0) return
    out('')
    out('================================================================')
    out('  Sleeve vs spline routing — full layoutGraphWithMds wall-clock')
    out('================================================================')
    out('')
    for (const line of renderTimeTable(rows)) out(line)
    out('')
    for (const line of renderLengthTable(rows)) out(line)
    out('')
    for (const line of renderLatexTimeTable(rows)) out(line)
    out('')
    for (const line of renderLatexLengthTable(rows)) out(line)
    out('')

    fs.writeFileSync(resultsFile, log.join('\n') + '\n')
    out(`Results written to ${resultsFile}`)
  })
})
