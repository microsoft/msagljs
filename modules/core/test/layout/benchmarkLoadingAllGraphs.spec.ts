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
  TileMap,
  Rectangle,
} from '@msagl/core'
import {EdgeRoutingMode} from '../../src/routing/EdgeRoutingMode'

const graphsDir = path.resolve(__dirname, '../../../../../paper_msagljs/graphs')
const resultsFile = path.resolve(__dirname, '../../../../../paper_msagljs/graphs_loading_benchmark.txt')

// ---------- parsers ----------

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

function makeRootTile(bb: Rectangle): Rectangle {
  const rootTileSize = 2 ** Math.ceil(Math.log2(Math.max(bb.width, bb.height)))
  return new Rectangle({
    left: bb.left - (rootTileSize - bb.width) / 2,
    bottom: bb.bottom - (rootTileSize - bb.height) / 2,
    right: bb.right + (rootTileSize - bb.width) / 2,
    top: bb.top + (rootTileSize - bb.height) / 2,
  })
}

// ---------- console.time interception to capture phase timings ----------

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

type Row = {
  name: string
  nodes: number
  edges: number
  parseMs: number
  layoutMs: number // total time for layoutGraphWithMds
  cdtMs: number // SleeveRouter CDT phase (initial routing only)
  routingMs: number // SleeveRouter routing phase (initial routing only)
  routingPhasesMs: number // cdtMs + routingMs
  tilingMs: number // TileMap.buildUpToLevel
  tileLevels: number
  totalMs: number // parse + layout + tiling
}

const MAX_TILE_LEVELS = 8 // matches Z_max in the paper
const TILE_CAPACITY = 500 // matches default C in the paper

function benchmark(name: string, parse: () => Graph): Row {
  // 1. parse
  const t0 = performance.now()
  const g = parse()
  const parseMs = performance.now() - t0
  const nodes = g.shallowNodeCount
  const edges = g.edgeCount

  // 2. geometry + layout + sleeve routing
  const gg = createGeometry(g)
  const settings = new MdsLayoutSettings()
  settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Sleeve
  gg.layoutSettings = settings

  const initialPhases: PhaseTimings = {}
  const t1 = performance.now()
  withPhaseCapture(initialPhases, () => {
    layoutGraphWithMds(gg, null)
  })
  const layoutMs = performance.now() - t1
  const cdtMs = initialPhases['SleeveRouter CDT'] ?? 0
  const routingMs = initialPhases['SleeveRouter routing'] ?? 0
  const routingPhasesMs = cdtMs + routingMs

  // 3. tiling
  const rootTile = makeRootTile(gg.boundingBox)
  const tileMap = new TileMap(gg, rootTile, TILE_CAPACITY)
  const t2 = performance.now()
  // Tile-internal routing also goes through SleeveRouter, but we deliberately
  // attribute that time to the tiling phase (not to the "routing phases" sum).
  const tileLevels = tileMap.buildUpToLevel(MAX_TILE_LEVELS)
  const tilingMs = performance.now() - t2

  return {
    name,
    nodes,
    edges,
    parseMs,
    layoutMs,
    cdtMs,
    routingMs,
    routingPhasesMs,
    tilingMs,
    tileLevels,
    totalMs: parseMs + layoutMs + tilingMs,
  }
}

function fmtMs(ms: number): string {
  if (ms >= 60_000) return (ms / 1000).toFixed(1) + 's'
  if (ms >= 1000) return (ms / 1000).toFixed(2) + 's'
  return ms.toFixed(0) + 'ms'
}

function pad(s: string, w: number, right = false): string {
  return right ? s.padEnd(w) : s.padStart(w)
}

function renderTable(rows: Row[]): string[] {
  const lines: string[] = []
  const headers = [
    {key: 'name', title: 'Graph', w: 22, right: true},
    {key: 'nodes', title: 'Nodes', w: 8},
    {key: 'edges', title: 'Edges', w: 8},
    {key: 'routingPhases', title: 'Routing (CDT+Dijk)', w: 20},
    {key: 'tiling', title: 'Tiling', w: 10},
    {key: 'total', title: 'Total loading', w: 14},
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
        pad(`${fmtMs(r.routingPhasesMs)} (${fmtMs(r.cdtMs)}+${fmtMs(r.routingMs)})`, headers[3].w),
        pad(fmtMs(r.tilingMs), headers[4].w),
        pad(fmtMs(r.totalMs), headers[5].w),
      ].join('  '),
    )
  }
  return lines
}

// ---------- spec ----------

// Disabled by default. Set MSAGL_BENCH=1 to opt in, e.g.:
//   MSAGL_BENCH=1 NODE_OPTIONS="--max-old-space-size=16384" \
//     npx jest --testPathPattern=benchmarkLoadingAllGraphs --no-coverage --runInBand
const runBench = process.env.MSAGL_BENCH === '1'
;(runBench ? describe : describe.skip)('Benchmark loading all graphs (sleeve routing + tiling)', () => {
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
      file: path.join(graphsDir, 'ca-GrQc.json'),
      parse: () => parseJsonNodesEdges(path.join(graphsDir, 'ca-GrQc.json')),
    },
    {
      name: 'facebook_combined',
      file: path.join(graphsDir, 'facebook_combined.txt'),
      parse: () => parseEdgeList(path.join(graphsDir, 'facebook_combined.txt')),
    },
    {
      name: 'ca-HepTh',
      file: path.join(graphsDir, 'ca-HepTh.json'),
      parse: () => parseJsonNodesEdges(path.join(graphsDir, 'ca-HepTh.json')),
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
    test(graph.name, () => {
      const r = benchmark(graph.name, graph.parse)
      rows.push(r)
      out(
        `${r.name}: nodes=${r.nodes} edges=${r.edges}  ` +
          `parse=${fmtMs(r.parseMs)} layout(MDS+sleeve)=${fmtMs(r.layoutMs)} ` +
          `[CDT=${fmtMs(r.cdtMs)} routing=${fmtMs(r.routingMs)}] ` +
          `tiling=${fmtMs(r.tilingMs)} (levels=${r.tileLevels}) total=${fmtMs(r.totalMs)}`,
      )
    }, 7_200_000)
  }

  afterAll(() => {
    if (rows.length === 0) return
    out('')
    out('================================================================')
    out(`  Loading benchmark — sleeve routing + tiling (capacity=${TILE_CAPACITY}, levels=${MAX_TILE_LEVELS})`)
    out('  Date: ' + new Date().toISOString())
    out('================================================================')
    for (const line of renderTable(rows)) out(line)
    out('')
    fs.writeFileSync(resultsFile, log.join('\n') + '\n')
    out(`Results written to: ${resultsFile}`)
  })
})
