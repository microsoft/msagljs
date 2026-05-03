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

// Graph corpus lives in the sibling paper repo. Fall back to a local
// `graphs/` dir if present (legacy layout).
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
const resultsTxt = path.join(resultsDir, 'tile_max_per_tile_results.txt')
const resultsTex = path.join(resultsDir, 'tile_max_per_tile_table.tex')

// ---------------------------------------------------------------------------
// Parsers
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

// ---------------------------------------------------------------------------
// Geometry / tiling helpers
// ---------------------------------------------------------------------------

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

interface Stats {
  maxOverall: number
  maxLevel: number
  maxAtFinest: number
  perLevel: number[] // max entityCount per level
}

function computeStats(tileMap: TileMap, numLevels: number): Stats {
  const perLevel: number[] = []
  let maxOverall = 0
  let maxLevel = 0
  for (let z = 0; z < numLevels; z++) {
    let levelMax = 0
    for (const tile of tileMap.getTilesOfLevel(z)) {
      const c = tile.data.entityCount
      if (c > levelMax) levelMax = c
    }
    perLevel.push(levelMax)
    if (levelMax > maxOverall) {
      maxOverall = levelMax
      maxLevel = z
    }
  }
  return {maxOverall, maxLevel, maxAtFinest: perLevel[numLevels - 1] ?? 0, perLevel}
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
  {name: 'facebook\\_combined', parse: () => parseEdgeList(path.join(graphsDir, 'facebook_combined.txt'))},
  {name: 'ca-GrQc', parse: () => parseSimpleJSON(path.join(graphsDir, 'ca-GrQc.json'))},
  {name: 'ca-HepTh', parse: () => parseSimpleJSON(path.join(graphsDir, 'ca-HepTh.json'))},
  {name: 'ca-CondMat', parse: () => parseEdgeList(path.join(graphsDir, 'ca-CondMat.txt'))},
  {name: 'ca-HepPh', parse: () => parseEdgeList(path.join(graphsDir, 'ca-HepPh.txt'))},
  {name: 'deezer\\_europe', parse: () => parseCSVEdges(path.join(graphsDir, 'deezer_europe', 'deezer_europe_edges.csv'))},
  {name: 'delaunay\\_n15', parse: () => parseMatrixMarket(path.join(graphsDir, 'delaunay_n15', 'delaunay_n15.mtx'))},
]

const MAX_LEVELS = 8 // matches Z_max in the paper
const TILE_CAPACITY = 500 // matches default C in the paper

interface Row {
  name: string
  nodes: number
  edges: number
  levels: number
  maxOverall: number
  maxLevel: number
  maxAtFinest: number
  perLevel: number[]
}

// Disabled by default. Set MSAGL_BENCH=1 to opt in, e.g.:
//   MSAGL_BENCH=1 NODE_OPTIONS="--max-old-space-size=16384" \
//     npx jest --testPathPattern=maxPerTile --no-coverage
const runBench = process.env.MSAGL_BENCH === '1'
;(runBench ? describe : describe.skip)('Max elements rendered per tile', () => {
  const rows: Row[] = []

  afterAll(() => {
    // Plain text report
    const lines: string[] = []
    lines.push('Max elements rendered per tile (capacity ' + TILE_CAPACITY + ', up to ' + MAX_LEVELS + ' levels)')
    lines.push('')
    const header =
      'Graph'.padEnd(22) +
      'Nodes'.padStart(8) +
      'Edges'.padStart(10) +
      'Lvls'.padStart(6) +
      'MaxAll'.padStart(8) +
      'MaxLvl'.padStart(8) +
      'MaxFinest'.padStart(11)
    lines.push(header)
    lines.push('-'.repeat(header.length))
    for (const r of rows) {
      lines.push(
        r.name.replace(/\\_/g, '_').padEnd(22) +
          r.nodes.toString().padStart(8) +
          r.edges.toString().padStart(10) +
          r.levels.toString().padStart(6) +
          r.maxOverall.toString().padStart(8) +
          r.maxLevel.toString().padStart(8) +
          r.maxAtFinest.toString().padStart(11),
      )
    }
    lines.push('')
    lines.push('Per-level max entityCount:')
    for (const r of rows) {
      lines.push('  ' + r.name.replace(/\\_/g, '_') + ': ' + r.perLevel.join(', '))
    }
    fs.writeFileSync(resultsTxt, lines.join('\n') + '\n')

    // LaTeX table snippet
    const tex: string[] = []
    tex.push('% Auto-generated by maxPerTile.spec.ts')
    tex.push('\\begin{table}[t]')
    tex.push('\\caption{Maximum number of elements rendered in a single tile across the pyramid (capacity $\\mathcal{C}=' + TILE_CAPACITY + '$, up to $Z=' + MAX_LEVELS + '$).}')
    tex.push('\\label{tab:max-per-tile}')
    tex.push('\\centering')
    tex.push('\\begin{tabular}{lrrrrr}')
    tex.push('\\toprule')
    tex.push('Graph & $|V|$ & $|E|$ & Levels & Max per tile & Max level \\\\')
    tex.push('\\midrule')
    for (const r of rows) {
      tex.push(`${r.name} & ${r.nodes} & ${r.edges} & ${r.levels} & ${r.maxOverall} & ${r.maxLevel} \\\\`)
    }
    tex.push('\\bottomrule')
    tex.push('\\end{tabular}')
    tex.push('\\end{table}')
    fs.writeFileSync(resultsTex, tex.join('\n') + '\n')

    // eslint-disable-next-line no-console
    console.log('Results written to:\n  ' + resultsTxt + '\n  ' + resultsTex)
  })

  for (const spec of graphs) {
    test(spec.name.replace(/\\_/g, '_'), () => {
      const t0 = performance.now()
      const g = spec.parse()
      // eslint-disable-next-line no-console
      console.log(`[${spec.name}] parsed: ${g.shallowNodeCount} nodes, ${g.edgeCount} edges (${(performance.now() - t0).toFixed(0)}ms)`)

      const gg = createGeometry(g)
      const settings = new MdsLayoutSettings()
      settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Sleeve
      gg.layoutSettings = settings
      const t1 = performance.now()
      layoutGraphWithMds(gg, null)
      // eslint-disable-next-line no-console
      console.log(`[${spec.name}] layout+sleeve: ${(performance.now() - t1).toFixed(0)}ms`)

      const rootTile = makeRootTile(gg.boundingBox)
      const tileMap = new TileMap(gg, rootTile, TILE_CAPACITY)
      const t2 = performance.now()
      const numLevels = tileMap.buildUpToLevel(MAX_LEVELS)
      // eslint-disable-next-line no-console
      console.log(`[${spec.name}] tiling: ${(performance.now() - t2).toFixed(0)}ms, levels=${numLevels}`)

      const stats = computeStats(tileMap, numLevels)
      // eslint-disable-next-line no-console
      console.log(`[${spec.name}] max-overall=${stats.maxOverall} (level ${stats.maxLevel}), max-finest=${stats.maxAtFinest}, per-level=[${stats.perLevel.join(', ')}]`)

      rows.push({
        name: spec.name,
        nodes: g.shallowNodeCount,
        edges: g.edgeCount,
        levels: numLevels,
        maxOverall: stats.maxOverall,
        maxLevel: stats.maxLevel,
        maxAtFinest: stats.maxAtFinest,
        perLevel: stats.perLevel,
      })

      expect(numLevels).toBeGreaterThan(0)
      expect(stats.maxOverall).toBeGreaterThan(0)
    }, 7200000)
  }
})
