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
  TileMap,
} from '@msagl/core'
import {EdgeRoutingMode} from '../../src/routing/EdgeRoutingMode'

const graphsDir = path.resolve(__dirname, '../../../../graphs')
const caHepPh = path.resolve(__dirname, '../../../../../paper_msagljs/graphs/ca-HepPh.txt')

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
  for (const e of g.deepEdges) new GeomEdge(e)
  return gg
}

// Skipped: this spec OOMs the default jest worker (requires >16GB heap).
// Enable manually for memory profiling.
describe.skip('ca-HepPh tile build repro', () => {
  test('build up to level 8 with StraightLine', () => {
    console.time('parse')
    const g = parseEdgeList(caHepPh)
    console.timeEnd('parse')
    console.log('nodes', g.shallowNodeCount, 'edges', g.edgeCount)
    const gg = createGeometry(g)
    const settings = new MdsLayoutSettings()
    settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Corridor
    gg.layoutSettings = settings
    console.time('layout')
    layoutGraphWithMds(gg, null)
    console.timeEnd('layout')
    const bb = gg.boundingBox
    const rootSize = Math.pow(2, Math.ceil(Math.log2(Math.max(bb.width, bb.height))))
    const rootTile = new Rectangle({
      left: bb.left - (rootSize - bb.width) / 2,
      bottom: bb.bottom - (rootSize - bb.height) / 2,
      right: bb.right + (rootSize - bb.width) / 2,
      top: bb.top + (rootSize - bb.height) / 2,
    })
    const tm = new TileMap(gg, rootTile)
    console.time('buildUpToLevel')
    const n = tm.buildUpToLevel(8)
    console.timeEnd('buildUpToLevel')
    console.log('levels built:', n)
    for (let z = 0; z < n; z++) {
      let clips = 0, tiles = 0
      for (const t of tm.getTilesOfLevel(z)) {
        tiles++
        clips += t.data.curveClips.length
      }
      console.log(`level ${z}: tiles=${tiles}, clips=${clips}`)
    }
  }, 1200000)
})
