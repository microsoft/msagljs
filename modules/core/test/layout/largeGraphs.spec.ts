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

const graphsDir = path.resolve(__dirname, '../../../../graphs')

/** Parse an edge-list file where each non-comment line has two node IDs separated by whitespace.
 *  Comment lines start with '#' or '%'. */
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

/** Parse a CSV edge file with a header line "node_1,node_2" */
function parseCSVEdges(filePath: string): Graph {
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

  const lines = content.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = line.split(',')
    if (parts.length < 2) continue
    const src = getOrAddNode(parts[0].trim())
    const tgt = getOrAddNode(parts[1].trim())
    if (src !== tgt) {
      new Edge(src, tgt)
    }
  }
  return g
}

/** Parse MatrixMarket (.mtx) coordinate pattern file */
function parseMatrixMarket(filePath: string): Graph {
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
    const src = getOrAddNode(parts[0])
    const tgt = getOrAddNode(parts[1])
    if (src !== tgt) {
      new Edge(src, tgt)
    }
  }
  return g
}

/** Create geometry for all nodes and edges of a graph */
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

/** Run MDS layout with the given edge routing mode */
function layoutWithRouting(gg: GeomGraph, mode: EdgeRoutingMode) {
  const settings = new MdsLayoutSettings()
  settings.edgeRoutingSettings.EdgeRoutingMode = mode
  gg.layoutSettings = settings
  layoutGraphWithMds(gg, null)
}

// These tests are skipped by default because they load large graph files
// and take a long time. Run explicitly with: npx jest --testPathPattern=graphLoading
describe.skip('Load graphs from ./graphs', () => {
  const routingModes = [
    {name: 'StraightLine', mode: EdgeRoutingMode.StraightLine},
    {name: 'Spline', mode: EdgeRoutingMode.Spline},
    {name: 'Sleeve', mode: EdgeRoutingMode.Sleeve},
  ]

  const graphs = [
    {name: 'facebook_combined', parse: () => parseEdgeList(path.join(graphsDir, 'facebook_combined.txt'))},
    {name: 'ca-CondMat', parse: () => parseEdgeList(path.join(graphsDir, 'ca-CondMat.txt'))},
    {name: 'deezer_europe', parse: () => parseCSVEdges(path.join(graphsDir, 'deezer_europe', 'deezer_europe_edges.csv'))},
    {name: 'delaunay_n15', parse: () => parseMatrixMarket(path.join(graphsDir, 'delaunay_n15', 'delaunay_n15.mtx'))},
  ]

  for (const graph of graphs) {
    for (const routing of routingModes) {
      test(graph.name + ' - ' + routing.name, () => {
        const g = graph.parse()
        console.log(graph.name + ' (' + routing.name + '): ' + g.shallowNodeCount + ' nodes, ' + g.edgeCount + ' edges')
        const gg = createGeometry(g)
        layoutWithRouting(gg, routing.mode)
        expect(gg.boundingBox).toBeDefined()
        expect(gg.boundingBox.width).toBeGreaterThan(0)
      }, 600000)
    }
  }
})
