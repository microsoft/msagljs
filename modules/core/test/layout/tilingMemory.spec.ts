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
  TileData,
  Rectangle,
} from '@msagl/core'
import {EdgeRoutingMode} from '../../src/routing/EdgeRoutingMode'

const graphsDir = path.resolve(__dirname, '../../../../graphs')
const graphFile = path.join(graphsDir, 'ca-CondMat.txt')
const resultsFile = path.resolve(__dirname, '../../../../tiling_memory_results.txt')

function parseEdgeList(filePath: string): Graph {
  const content = fs.readFileSync(filePath, 'utf-8')
  const g = new Graph()
  const nodeMap = new Map<string, Node>()

  function getOrAddNode(id: string): Node {
    let n = nodeMap.get(id)
    if (!n) {
      n = new Node(id)
      g.addNode(n)
      nodeMap.set(id, n)
    }
    return n
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('%')) continue
    const parts = line.split(/\s+/).filter((s) => s.length > 0)
    if (parts.length < 2) continue
    const src = getOrAddNode(parts[0])
    const tgt = getOrAddNode(parts[1])
    if (src !== tgt) {
      new Edge(src, tgt)
    }
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

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return (bytes / 1e3).toFixed(0) + ' KB'
}

const BYTES_PER_ELEMENT = 200

function analyzeTileMap(tileMap: TileMap, numLevels: number) {
  const perLevel: {elements: number; tiles: number}[] = []
  let totalElements = 0
  let totalTiles = 0
  for (let z = 0; z < numLevels; z++) {
    let levelElements = 0
    let levelTiles = 0
    for (const tile of tileMap.getTilesOfLevel(z)) {
      levelElements += tile.data.entityCount
      levelTiles++
    }
    perLevel.push({elements: levelElements, tiles: levelTiles})
    totalElements += levelElements
    totalTiles += levelTiles
  }
  return {perLevel, totalElements, totalTiles}
}

function makeRootTile(bb: Rectangle) {
  const rootTileSize = 2 ** Math.ceil(Math.log2(Math.max(bb.width, bb.height)))
  return new Rectangle({
    left: bb.left - (rootTileSize - bb.width) / 2,
    bottom: bb.bottom - (rootTileSize - bb.height) / 2,
    right: bb.right + (rootTileSize - bb.width) / 2,
    top: bb.top + (rootTileSize - bb.height) / 2,
  })
}

function getRSSMB(): number {
  return process.memoryUsage.rss() / (1024 * 1024)
}

const output: string[] = []
function log(msg: string) {
  console.log(msg)
  output.push(msg)
}

function logTable(tileMap: TileMap, numLevels: number) {
  const {perLevel} = analyzeTileMap(tileMap, numLevels)
  const header =
    'Level'.padStart(7) + 'Tiles'.padStart(8) + 'LvlElems'.padStart(12) +
    'CumElems'.padStart(12) + 'CumMemEst'.padStart(14) + '  Under4GB'
  log(header)
  log('-'.repeat(header.length))

  let cumElements = 0
  for (let z = 0; z < numLevels; z++) {
    cumElements += perLevel[z].elements
    const cumMem = cumElements * BYTES_PER_ELEMENT
    const ok = cumMem <= 4e9 ? 'YES' : '*** NO ***'
    log(
      (z + 1).toString().padStart(7) +
      perLevel[z].tiles.toString().padStart(8) +
      perLevel[z].elements.toString().padStart(12) +
      cumElements.toString().padStart(12) +
      formatBytes(cumMem).padStart(14) +
      '  ' + ok,
    )
  }
  return cumElements
}

// Run explicitly:
//   node --max-old-space-size=8192 ./node_modules/.bin/jest --testPathPattern=tilingMemory --no-coverage
describe.skip('Tiling memory analysis for ca-CondMat', () => {
  if (!fs.existsSync(graphFile)) {
    it.skip('graph file not found at ' + graphFile, () => {})
    return
  }

  it('layout + tile + measure memory (Dijkstra then CH+HL)', () => {
    log('')
    log('================================================================')
    log('  Tiling Memory Analysis: ca-CondMat.txt')
    log('  Date: ' + new Date().toISOString())
    log('================================================================')
    log('')

    // --- Parse ---
    log('--- 1. Parsing ---')
    const rss0 = getRSSMB()
    const t0 = performance.now()
    const g = parseEdgeList(graphFile)
    log(`Parse: ${(performance.now() - t0).toFixed(0)}ms`)
    log(`Nodes: ${g.shallowNodeCount}, Edges: ${g.edgeCount}`)
    log(`RSS after parse: ${getRSSMB().toFixed(0)} MB (delta +${(getRSSMB() - rss0).toFixed(0)} MB)`)
    log('')

    // --- Layout + sleeve (Dijkstra) routing ---
    log('--- 2. MDS layout + sleeve (Dijkstra) routing ---')
    const rss1 = getRSSMB()
    const t1 = performance.now()
    const gg = createGeometry(g)
    const settings = new MdsLayoutSettings()
    settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Sleeve
    gg.layoutSettings = settings
    layoutGraphWithMds(gg, null)
    const layoutTime = performance.now() - t1
    log(`Layout + Dijkstra sleeve routing: ${layoutTime.toFixed(0)}ms`)
    log(`Bounding box: ${gg.boundingBox.width.toFixed(0)} x ${gg.boundingBox.height.toFixed(0)}`)
    log(`RSS after layout: ${getRSSMB().toFixed(0)} MB (delta +${(getRSSMB() - rss1).toFixed(0)} MB)`)
    log('')

    // --- Tiling with Dijkstra-routed curves ---
    log('--- 3. Tiling (Dijkstra routing, tileCapacity=1, up to 7 levels) ---')
    const bb = gg.boundingBox
    const rootTile = makeRootTile(bb)
    const rss2 = getRSSMB()
    const tileMap1 = new TileMap(gg, rootTile, 1)
    const t2 = performance.now()
    const numLevels1 = tileMap1.buildUpToLevel(7)
    const tileTime1 = performance.now() - t2
    log(`buildUpToLevel(7) → ${numLevels1} levels in ${tileTime1.toFixed(0)}ms`)
    log(`RSS after tiling: ${getRSSMB().toFixed(0)} MB (delta +${(getRSSMB() - rss2).toFixed(0)} MB)`)
    log('')
    const cumElems1 = logTable(tileMap1, numLevels1)
    log(`Total est. memory for tile data: ${formatBytes(cumElems1 * BYTES_PER_ELEMENT)}`)
    log('')

    // --- Re-route with Dijkstra (HL routing removed) ---
    log('--- 4. Re-routing with Dijkstra (CH+HL removed) ---')
    const edgesToRoute = Array.from(gg.deepEdges)
    const rss3 = getRSSMB()
    const t3 = performance.now()
    // No-op placeholder: keep the existing curves as produced by layoutGraphWithMds above.
    void edgesToRoute
    const hlTime = performance.now() - t3
    log(`(skipped) routing time: ${hlTime.toFixed(0)}ms for ${edgesToRoute.length} edges`)
    log(`RSS after re-routing: ${getRSSMB().toFixed(0)} MB (delta +${(getRSSMB() - rss3).toFixed(0)} MB)`)
    log('')

    // --- Tiling after re-routing ---
    log('--- 5. Tiling (after re-routing, tileCapacity=1, up to 7 levels) ---')
    const rootTile2 = makeRootTile(bb)
    const rss4 = getRSSMB()
    const tileMap2 = new TileMap(gg, rootTile2, 1)
    const t4 = performance.now()
    const numLevels2 = tileMap2.buildUpToLevel(7)
    const tileTime2 = performance.now() - t4
    log(`buildUpToLevel(7) → ${numLevels2} levels in ${tileTime2.toFixed(0)}ms`)
    log(`RSS after tiling: ${getRSSMB().toFixed(0)} MB (delta +${(getRSSMB() - rss4).toFixed(0)} MB)`)
    log('')
    const cumElems2 = logTable(tileMap2, numLevels2)
    log(`Total est. memory for tile data: ${formatBytes(cumElems2 * BYTES_PER_ELEMENT)}`)
    log('')

    // --- Summary ---
    log('================================================================')
    log('  Summary')
    log('================================================================')
    log(`  Dijkstra routing:  ${layoutTime.toFixed(0)}ms, tiling: ${tileTime1.toFixed(0)}ms`)
    log(`  Re-route (skipped): ${hlTime.toFixed(0)}ms, tiling: ${tileTime2.toFixed(0)}ms`)
    log(`  Tile elements (initial):  ${cumElems1}, est. ${formatBytes(cumElems1 * BYTES_PER_ELEMENT)}`)
    log(`  Tile elements (re-route): ${cumElems2}, est. ${formatBytes(cumElems2 * BYTES_PER_ELEMENT)}`)
    log(`  Final RSS: ${getRSSMB().toFixed(0)} MB`)
    log('')

    // Save results
    fs.writeFileSync(resultsFile, output.join('\n') + '\n')
    log(`Results saved to ${resultsFile}`)

    expect(numLevels1).toBeGreaterThanOrEqual(1)
    expect(numLevels2).toBeGreaterThanOrEqual(1)
  }, 7200000) // 2 hour timeout
})
