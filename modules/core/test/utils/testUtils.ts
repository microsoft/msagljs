import * as fs from 'fs'
import * as path from 'path'
import {
  GeomEdge,
  Point,
  interpolateICurve,
  MdsLayoutSettings,
  GeomGraph,
  ICurve,
  CurveFactory,
  GeomNode,
  GeomLabel,
  Graph,
  Size,
  Node,
  Edge,
} from '../../src'
import {SvgDebugWriter} from './svgDebugWriter'
import {EdgeRoutingMode} from '../../src/routing/EdgeRoutingMode'
import {parseDotString} from '../../src/drawing/dotparser'
import {DrawingGraph} from '../../src/drawing'
import {layoutGraphWithMds} from '../../src/layout/mds/PivotMDS'
import {DrawingObject} from '../../src/drawing/drawingObject'
import {GeomObject} from '../../src/layout/core/geomObject'
import {IntPairSet} from '../../src/utils/IntPairSet'
import {initRandom, randomInt} from '../../src/utils/random'
import {Queue} from 'queue-typescript'
import {Assert} from '../../src/utils/assert'

/** this measure function is tailored for SVG */
export function measureTextSize(str: string): Size {
  if (!str) {
    return new Size(0, 0)
  }
  const lines = str.split('\n')
  const w = lines.map((s) => s.length * 15).reduce((a: number, b: number) => Math.max(a, b), 0)
  return new Size(w, 15 * lines.length)
}
export function setNode(g: GeomGraph, id: string, xRad: number, yRad: number, center = new Point(0, 0)): GeomNode {
  let node = g.graph.findNode(id)
  if (node == null) {
    g.graph.addNode((node = new Node(id)))
  }
  const geomNode = new GeomNode(node)
  const size = measureTextSize(id)
  geomNode.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(size.width, size.height, xRad, yRad, center)
  return geomNode
}
export function edgeString(e: GeomEdge, edgesAsArrays: boolean): string {
  const s = e.source.id + '->' + e.target.id
  return s + ', curve(' + (edgesAsArrays ? interpolateEdgeAsString() : SvgDebugWriter.curveString(e.curve)) + ')'
  function interpolateEdgeAsString(): string {
    const ps = interpolateEdge(e)
    let s = '[' + ps[0].toString()
    for (let i = 1; i < ps.length; i++) {
      s += ' ' + ps[i].toString()
    }
    return s + ']'
  }
}

function interpolateEdge(edge: GeomEdge): Point[] {
  if (edge == null) return []
  let ret = new Array<Point>()
  if (edge.sourceArrowhead != null) ret = ret.concat(addArrow(edge.curve.start, edge.sourceArrowhead.tipPosition, 25))
  ret = ret.concat(interpolateICurve(edge.curve, 1))
  if (edge.targetArrowhead != null) {
    ret = ret.concat(addArrow(edge.curve.end, edge.targetArrowhead.tipPosition, 25))
  }
  return ret
}
function addArrow(start: Point, end: Point, arrowAngle: number): Point[] {
  let dir = end.sub(start)
  const l = dir.length
  dir = dir.div(l).rotate90Ccw()
  dir = dir.mul(l * Math.tan(arrowAngle * 0.5 * (Math.PI / 180.0)))
  return [start, start.add(dir), end, start.sub(dir), start]
}

export function runMDSLayout(fname: string, edgeRoutingMode = EdgeRoutingMode.StraightLine) {
  const dg = parseDotGraph(fname)
  if (dg == null) return null
  dg.createGeometry(labelRectFunc)
  const gg = <GeomGraph>GeomObject.getGeom(dg.graph)
  const settings = new MdsLayoutSettings()
  gg.layoutSettings = settings
  settings.edgeRoutingSettings.EdgeRoutingMode = edgeRoutingMode
  gg.layoutSettings = settings
  layoutGraphWithMds(gg, null)
  return dg
}

export function runMDSLayoutNoSubgraphs(fname: string, edgeRoutingMode: EdgeRoutingMode) {
  const dg = parseDotGraph(fname)
  if (dg == null) return null
  if (dg.graph.hasSubgraphs()) return null

  dg.createGeometry(labelRectFunc)
  const gg = <GeomGraph>GeomObject.getGeom(dg.graph)
  const settings = new MdsLayoutSettings()
  settings.edgeRoutingSettings.EdgeRoutingMode = edgeRoutingMode
  gg.layoutSettings = settings
  layoutGraphWithMds(gg, null)
  return dg
}

export function outputGraph(g: GeomGraph, name: string) {
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/' + name + '.svg')
  t.writeGeomGraph(g)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function nodeBoundaryFunc(label: string): ICurve {
  const size = measureTextSize(label)
  return CurveFactory.mkRectangleWithRoundedCorners(size.width, size.height, size.width / 10, size.height / 10, new Point(0, 0))
}

export function parseDotGraph(fileName: string, absolutePath = false): DrawingGraph {
  try {
    const fpath = absolutePath ? fileName : path.resolve(__dirname, '../data', fileName)
    const graphStr = fs.readFileSync(fpath, 'utf-8')
    return parseDotString(graphStr)
  } catch (Error) {
    // console.log('file = ' + fileName + ' error:' + Error.message)
    return null
  }
}
export const fontHeight = 10.5
export function labelRectFunc(text: string): Size {
  const len = text ? text.length : 0.1
  return new Size(len * 10, fontHeight)
}

function measureTextSizeOfNode(n: Node): Size {
  const drawingObject = DrawingObject.getDrawingObj(n)

  const labelText = drawingObject ? drawingObject.labelText ?? n.id : n.id

  return measureTextSize(labelText)
}

export function createGeometry(g: Graph, nodeBoundaryFunc: (s: string) => ICurve, labelRect: (s: string) => Size): GeomGraph {
  for (const n of g.shallowNodes) {
    if (n instanceof Graph) {
      const subG = n as unknown as Graph
      GeomGraph.mkWithGraphAndLabel(subG, measureTextSizeOfNode(subG))
      createGeometry(subG, nodeBoundaryFunc, labelRect)
    } else {
      const gn = new GeomNode(n)
      //const tsize = getTextSize(drawingNode.label.text, drawingNode.fontname)
      const drawingObject = DrawingObject.getDrawingObj(n)
      const text = drawingObject ? drawingObject.labelText ?? n.id : n.id
      gn.boundaryCurve = nodeBoundaryFunc(text)
    }
  }
  for (const e of g.edges) {
    const ge = new GeomEdge(e)
    if (e.label) {
      /*Assert.assert(e.label != null)*/
      ge.label = new GeomLabel(labelRect(e.label.text), e.label)
    }
  }
  return GeomGraph.mkWithGraphAndLabel(g, measureTextSizeOfNode(g))
}

export function generateRandomGeomGraph(
  seed: number,
  nodeCount: number,
  curveDelegate: (w: number, h: number, xy: Point) => ICurve = (w, h, xy) => CurveFactory.mkRectangleWithRoundedCorners(w, h, 1, 1, xy),
  edgeCount = nodeCount,
): GeomGraph {
  initRandom(seed)
  const w = 20
  const h = 20
  const gg = new GeomGraph(new Graph())

  const takenPairs = new IntPairSet()
  const nodes: GeomNode[] = []
  for (let n = 0; n < nodeCount; n++) {
    nodes.push(<GeomNode>GeomObject.getGeom(addNode(gg, getLabel(n), getRandomCurve(nodeCount, w, h, takenPairs, curveDelegate))))
  }

  // we want to add nodeCount edges as well
  takenPairs.clear()
  const edges: GeomEdge[] = []
  while (edges.length < edgeCount) {
    addEdge(nodes, takenPairs, edges)
  }

  return gg
}

export function generateRandomGeomGraphWithSubgraphs(
  seed: number,
  nodeCount: number,
  curveDelegate: (w: number, h: number, xy: Point) => ICurve = (w, h, xy) => CurveFactory.mkRectangleWithRoundedCorners(w, h, 1, 1, xy),
  edgeCount = nodeCount,
): GeomGraph {
  initRandom(seed)
  const graph: Graph = createRandomGraphWithSubgraphs(seed, nodeCount, edgeCount)
  return mkGeomForGraph(graph, curveDelegate)
}

function addNode(gg: GeomGraph, id: string, c: ICurve): Node {
  const node: Node = gg.graph.addNode(new Node(id))

  const geomNodea = new GeomNode(node)
  geomNodea.boundaryCurve = c
  return node
}

function getRandomCurve(
  nodes: number,
  w: number,
  h: number,
  takenRects: IntPairSet,
  curveDelegate: (w: number, h: number, xy: Point) => ICurve,
): ICurve {
  const [x, y] = findNewPair(takenRects, nodes)
  takenRects.addNN(x, y)
  return curveDelegate(w, h, new Point(2 * w * x, 2 * h * y))
}

function findNewPair(takenRects: IntPairSet, max: number): [number, number] {
  do {
    const x = randomInt(max)
    const y = randomInt(max)
    if (!takenRects.hasxy(x, y)) return [x, y]
  } while (true)
}

function addEdge(nodes: GeomNode[], takenPairs: IntPairSet, edges: GeomEdge[]): GeomEdge {
  const i = randomInt(nodes.length)
  let j: number
  do {
    j = randomInt(nodes.length)
    if (takenPairs.hasxy(i, j)) continue
  } while (i == j)
  takenPairs.addNN(i, j)
  const e = new GeomEdge(new Edge(nodes[i].node, nodes[j].node))
  edges.push(e)
  return e
}
function getLabel(n: number): string {
  const a_index = 'a'.charCodeAt(0)
  return String.fromCharCode(a_index + n)
}

export function createRandomGraphWithSubgraphs(seed: number, nodeCount: number, edgeCount: number): Graph {
  const q = new Queue<Graph>()
  const graph = new Graph()
  q.enqueue(graph)
  initRandom(seed)
  generateRandomGraphOnQueue(q, nodeCount, 0)
  generateEdges(graph, edgeCount)
  return graph
}

export function generateRandomGraphOnQueue(q: Queue<Graph>, nodeCount: number, createdNodeCount: number): void {
  while (q.length > 0) {
    const graph = q.dequeue()
    Assert.assert(graph.isEmpty())
    let nodesToAdd = randomInt(nodeCount)
    nodeCount -= nodesToAdd
    let graphsToAdd = nodesToAdd == 0 ? 0 : randomInt(nodesToAdd)

    nodesToAdd -= graphsToAdd
    while (nodesToAdd-- > 0) {
      const node = new Node(getLabel(createdNodeCount++))
      graph.addNode(node)
    }
    if (graph.isEmpty()) {
      if (graph.parent) {
        const gp = <Graph>graph.parent
        gp.removeNode(graph)
      }
    }
    while (graphsToAdd-- > 0) {
      const g = new Graph(getLabel(createdNodeCount++))
      graph.addNode(g)
      q.enqueue(g)
    }
  }
}

function generateEdges(g: Graph, edgeCount: number) {
  const nodes = Array.from(g.deepNodes)
  if (nodes.length == 0) return
  while (edgeCount-- > 0) {
    const i = randomInt(nodes.length)
    let j = randomInt(nodes.length)
    if (j == i) {
      j = (j + 1) % nodes.length
    }
    new Edge(nodes[i], nodes[j])
  }
}
function mkGeomForGraph(g: Graph, curveDelegate: (w: number, h: number, xy: Point) => ICurve): GeomGraph {
  const gg = new GeomGraph(g)
  for (const n of g.deepNodes) {
    if (n instanceof Graph) {
      new GeomGraph(<Graph>n).labelSize = measureTextSize(n.id)
    } else {
      const gn = new GeomNode(n)
      const size = measureTextSize(n.id)
      gn.boundaryCurve = curveDelegate(size.width, size.height, new Point(0, 0))
    }
  }
  for (const e of g.deepEdges()) {
    new GeomEdge(e)
  }

  return gg
}
