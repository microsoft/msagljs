import {SortedMap} from '@esfx/collections-sortedmap'

import {StringBuilder} from 'typescript-string-operations'

import {join} from 'path'
import * as fs from 'fs'

import {sortedList} from '../sortedBySizeListOfgvFiles'

import {outputGraph, edgeString, parseDotGraph, setNode, measureTextSize, parseJSONFile} from '../../utils/testUtils'
import {
  Node,
  GeomGraph,
  GeomNode,
  Rectangle,
  LayeredLayout,
  SugiyamaLayoutSettings,
  CancelToken,
  Size,
  LayerDirectionEnum,
  Graph,
  GeomEdge,
  Edge,
  MdsLayoutSettings,
  EdgeRoutingMode,
  layoutGraphWithMds,
  clipWithRectangle,
} from '../../../src'
import {ArrowTypeEnum, DrawingEdge, DrawingGraph, DrawingNode} from '../../../src/drawing'
import {parseDot} from '@msagl/parser'
import {Arrowhead} from '../../../src/layout/core/arrowhead'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {Curve, CurveFactory, ICurve, LineSegment, parameterSpan, Point} from '../../../src/math/geometry'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'
import {layoutGraphWithSugiayma} from '../../../src/layout/layered/layeredLayout'
import {TextMeasurerOptions} from '../../../src/drawing/color'
import {DebugCurve} from '../../../src/math/geometry/debugCurve'
type P = [number, number]

test('map test', () => {
  const m = new Map<number, string>()
  m.set(1, '1')
  m.set(2.1, '2')
  const r = 2.1
  expect(m.get(1)).toBe('1')
  expect(m.get(r)).toBe('2')
  expect(m.get(2.1)).toBe('2')
  m.set(1, '4')
  expect(m.get(1)).toBe('4')
  const mi = new Map<P, string>()
  const ip0: P = [0, 0]
  mi.set(ip0, 'ip0')
  expect(mi.get(ip0)).toBe('ip0')
  const ip1: P = [0, 0]

  expect(mi.get(ip1)).toBe(undefined)
})

test('self on node', () => {
  const g = GeomGraph.mk('graph', Rectangle.mkEmpty())
  setNode(g, 'a', 10, 10)
  g.setEdge('a', 'a')
  g.layoutSettings = new SugiyamaLayoutSettings()
  layoutGraphWithSugiayma(g, null) // null for the CancelToken that is ignored at the moment
  for (const e of g.edges()) {
    expect(e.curve == null).toBe(false)
  }
  // SvgDebugWriter.writeGeomGraph('/tmp/self.svg', g)
})

test('layered layout glued graph', () => {
  const graphString = 'digraph G {\n' + 'a -> b\n' + 'a -> b}'
  const graph = parseDot(graphString)
  const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  createGeometry(dg, measureTextSize)
  const ll = new LayeredLayout(GeomObject.getGeom(graph) as GeomGraph, new SugiyamaLayoutSettings(), new CancelToken())
  ll.CreateGluedDagSkeletonForLayering()
  for (const e of ll.gluedDagSkeletonForLayering.edges) {
    expect(e.weight).toBe(2)
  }
})

test('sorted map', () => {
  const m = new SortedMap<number, number>()
  m.set(0, 0)
  m.set(-1, -1)
  m.set(2, 2)
  const a = []
  for (const [k, v] of m.entries()) {
    expect(k).toBe(v)
    a.push(k)
  }
  for (const t of a) {
    expect(m.get(t)).toBe(t)
  }
  expect(a[0]).toBe(-1)
  expect(a[1]).toBe(0)
  expect(a[2]).toBe(2)
  expect(m.size === 3)
})

test('show API', () => {
  // Create a new geometry graph
  const g = GeomGraph.mk('graph', new Size(0, 0))
  // Add nodes to the graph. The first argument is the node id. The second is the size string
  setNode(g, 'kspacey', 10, 10)
  setNode(g, 'swilliams', 10, 10)
  setNode(g, 'bpitt', 10, 10)
  setNode(g, 'hford', 10, 10)
  setNode(g, 'lwilson', 10, 10)
  setNode(g, 'kbacon', 10, 10)

  // Add edges to the graph.
  g.setEdge('kspacey', 'swilliams')
  g.setEdge('swilliams', 'kbacon')
  g.setEdge('bpitt', 'kbacon')
  g.setEdge('hford', 'lwilson')
  g.setEdge('lwilson', 'kbacon')
  const ss = new SugiyamaLayoutSettings()
  g.layoutSettings = ss
  layoutGraphWithSugiayma(g)
  outputGraph(g, 'TB')
  ss.layerDirection = LayerDirectionEnum.BT
  layoutGraphWithSugiayma(g)
  outputGraph(g, 'BT')
  ss.layerDirection = LayerDirectionEnum.LR
  layoutGraphWithSugiayma(g)
  outputGraph(g, 'LR')
  ss.layerDirection = LayerDirectionEnum.RL
  layoutGraphWithSugiayma(g)
  outputGraph(g, 'RL')
})

test('disconnected comps', () => {
  // Create a new geometry graph
  const g = GeomGraph.mk('graph', Rectangle.mkEmpty())
  // Add nodes to the graph. The first argument is the node id. The second is the size string
  setNode(g, 'kspacey', 10, 10)
  setNode(g, 'swilliams', 10, 10)
  setNode(g, 'bpitt', 10, 10)
  setNode(g, 'hford', 10, 10)
  setNode(g, 'lwilson', 10, 10)
  setNode(g, 'kbacon', 10, 10)

  // Add edges to the graph.
  g.setEdge('kspacey', 'swilliams')
  g.setEdge('swilliams', 'kbacon')
  g.setEdge('bpitt', 'kbacon')
  g.setEdge('hford', 'lwilson')
  g.setEdge('lwilson', 'kbacon')
  duplicateDisconnected(g, '_')
  duplicateDisconnected(g, '__')
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(g, ss, new CancelToken())
  ll.run()
  const strB = new StringBuilder()
  for (const n of g.shallowNodes) {
    const s = n.id + ', center = ' + n.center
    strB.AppendLine(s)
  }
  strB.AppendLine('edges')
  for (const e of g.edges()) {
    strB.AppendLine(edgeString(e, true)) // true to get an array of poins
  }

  // console.log(strB.ToString())
  // SvgDebugWriter.writeGeomGraph('/tmp/disconnected.svg', g)
})
function color(i: number) {
  if (i == 0) {
    return 'Blue'
  }
  if (i == 1) {
    return 'Green'
  }
  return 'Black'
}
test('margins', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/abstract.gv'))
  createGeometry(dg, measureTextSize)
  const ss = new SugiyamaLayoutSettings()
  const gg = GeomGraph.getGeom(dg.graph)
  gg.margins = {left: 100, right: 10, top: 170, bottom: 50}
  const ll = new LayeredLayout(GeomObject.getGeom(dg.graph) as GeomGraph, ss, new CancelToken())
  ll.run()
  // SvgDebugWriter.writeGeomGraph(    '/tmp/abstract_margins_' + gg.margins.left + '_' + gg.margins.top + '.svg',    GeomObject.getGeom(dg.graph) as GeomGraph,  )
  const g = GeomObject.getGeom(dg.graph) as GeomGraph
  const dc = Array.from(g.deepEdges)
    .map((e, i) => DebugCurve.mkDebugCurveCI(color(i), e.curve))
    .concat(Array.from(g.deepEdges).map((e, i) => DebugCurve.mkDebugCurveCI(color(i), e.boundingBox.perimeter())))
  SvgDebugWriter.dumpDebugCurves('/tmp/arr.svg', dc)
})

test('undirected pach', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/pack.gv'))
  createGeometry(dg, measureTextSize)
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(GeomObject.getGeom(dg.graph) as GeomGraph, ss, new CancelToken())
  ll.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/undir_pack.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
})

xtest('austin', () => {
  const data = fs.readFileSync('examples/data/gameofthrones.json').toString()
  const graphJson = JSON.parse(data)
  const graph = new Graph()
  const dg = new DrawingGraph(graph)
  dg.rankdir = LayerDirectionEnum.LR
  for (const node of graphJson.nodes) {
    const n = graph.addNode(new Node(node.id))
    const dn = new DrawingNode(n)
    dn.labelText = node.label
  }
  for (const edge of graphJson.edges) {
    const s = graph.findNode(edge.source)
    const t = graph.findNode(edge.target)
    const e = new Edge(s, t)
    const de = new DrawingEdge(e)

    de.arrowhead = ArrowTypeEnum.none
    de.arrowtail = ArrowTypeEnum.none
  }

  createGeometry(dg, measureTextSize)
  const gg = GeomGraph.getGeom(dg.graph)
  const ss = new MdsLayoutSettings()
  gg.layoutSettings = ss
  ss.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
  layoutGraphWithMds(gg)
  for (const e of gg.deepEdges) {
    expect(e.curve == null).toBe(false)
  }
  // SvgDebugWriter.writeGeomGraph('/tmp/gameOfThrones.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
})

test('clust.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/clust.gv', ss)
  // SvgDebugWriter.writeGeomGraph('/tmp/clust_.gv.svg', <GeomGraph>GeomObject.getGeom(dg.graph))
})

test('clust5.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/clust5.gv', ss)
  // SvgDebugWriter.writeGeomGraph('/tmp/clust5_.svg', <GeomGraph>GeomObject.getGeom(dg.graph))
})

test('b56.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/b56.gv', ss)
  // SvgDebugWriter.writeGeomGraph('/tmp/b56.svg', <GeomGraph>GeomObject.getGeom(dg.graph))
})

test('smlred.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/smlred.gv', ss)
  // SvgDebugWriter.writeGeomGraph('/tmp/smlredLayered.svg', <GeomGraph>GeomObject.getGeom(dg.graph))
})

test('b51.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/b51.gv', ss)
  // SvgDebugWriter.writeGeomGraph('/tmp/b51Layered.svg', <GeomGraph>GeomObject.getGeom(dg.graph))
})

test('arrowhead size default', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/abstract.gv'))
  Arrowhead.defaultArrowheadLength *= 2
  const geomGraph = createGeometry(dg, measureTextSize)
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(geomGraph, ss, new CancelToken())
  ll.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/longArrows.svg', <GeomGraph>GeomObject.getGeom(dg.graph))
})

test('arrowhead size per edge', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/abstract.gv'))
  const geomGraph = createGeometry(dg, measureTextSize)
  for (const e of geomGraph.edges()) {
    if (e.sourceArrowhead) {
      e.sourceArrowhead.length /= 2
    }
    if (e.targetArrowhead) {
      e.targetArrowhead.length /= 2
    }
  }
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(geomGraph, ss, new CancelToken())
  ll.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/arrowheadLength.svg', geomGraph)
})

test('graphvis/ER.gv', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/ER.gv'))
  if (dg == null) return
  createGeometry(dg, measureTextSize)
})

test('b.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  ss.BrandesThreshold = 1
  const dg = runLayout('graphvis/b.gv', ss)
  // SvgDebugWriter.writeGeomGraph('/tmp/btest.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
})
test('b7.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  ss.BrandesThreshold = 1
  const dg = runLayout('graphvis/b.gv', ss)
  // SvgDebugWriter.writeGeomGraph('/tmp/b7test.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
})
xtest('fsm.gv with Brand', () => {
  const ss = new SugiyamaLayoutSettings()
  ss.BrandesThreshold = 1
  const dg = runLayout('graphvis/fsm.gv', ss)
  // SvgDebugWriter.writeGeomGraph('/tmp/fsmbrandes.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
  // console.log(qualityMetric(GeomObject.getGeom(dg.graph) as GeomGraph))
})
test('fsm.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/fsm.gv', ss)
  // SvgDebugWriter.writeGeomGraph('/tmp/fsmNetworkSimplex.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
})

xtest('b100', () => {
  const dg = runLayout('graphvis/b100.gv')
  // SvgDebugWriter.writeGeomGraph('/tmp/b100.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
})
test('pmpipe.gv', () => {
  const dg = runLayout('graphvis/pmpipe.gv')
  // SvgDebugWriter.writeGeomGraph('/tmp/pmpipe.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
})

test('layered layout empty graph', () => {
  const gg = GeomGraph.mk('graph', Rectangle.mkEmpty())
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(gg, ss, new CancelToken())
  ll.run()
})

// the smaller number the better layout
export function qualityMetric(gg: GeomGraph): number {
  let r = 0 // the sum of edges length
  for (const e of gg.edges()) {
    r += e.source.center.sub(e.target.center).length
  }
  const internsectionWeight = 100
  for (const e of gg.edges()) {
    for (const u of gg.edges()) {
      if (e === u) continue
      if (crossed(e, u)) {
        r += internsectionWeight
      }
    }
  }
  return r
}

test('layered layout nodes only', () => {
  const g = new GeomGraph(new Graph('graph'))
  setNode(g, 'kspacey', 10, 10)
  setNode(g, 'swilliams', 10, 10)
  setNode(g, 'bpitt', 10, 10)
  setNode(g, 'hford', 10, 10)
  setNode(g, 'lwilson', 10, 10)
  setNode(g, 'kbacon', 10, 10)
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(g, ss, new CancelToken())
  ll.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/nodes_only.svg', g)
})

function runLayout(fname: string, settings: SugiyamaLayoutSettings = null) {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph(fname))
  if (dg == null) return null
  const gg = createGeometry(dg, measureTextSize)
  if (settings) {
    gg.layoutSettings = settings
  } else {
    const ss = new SugiyamaLayoutSettings()
    gg.layoutSettings = ss
    if (dg.rankdir) {
      ss.layerDirection = dg.rankdir
    }
  }
  layoutGraphWithSugiayma(gg, null)
  return dg
}

// function runLayout(
//  fname: string,
//  ss: SugiyamaLayoutSettings = new SugiyamaLayoutSettings(),
// ) {
//  const dg = DrawingGraph.getDrawingGraph(parseDotGraph(fname))
//  if (dg == null ) return null
//  createGeometry(dg.graph, nodeBoundaryFunc, measureTextSize)
//  const ll = new LayeredLayout(
//    GeomObject.getGeom(dg.graph) as GeomGraph,
//    ss,
//    new CancelToken(),
//  )

//  ll.run()

//  return dg
// }

test('root', () => {
  const fname = 'graphvis/root.gv'
  const dg = runLayout(fname)
  if (dg != null) {
    // SvgDebugWriter.writeGeomGraph('/tmp/' + 'root.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
  }
})

test('compound', () => {
  const dg = runLayout('graphvis/compound.gv')
  outputGraph(<GeomGraph>GeomObject.getGeom(dg.graph), 'compound')
})

test('fdp', () => {
  const dg = runLayout('graphvis/fdp.gv')
  outputGraph(<GeomGraph>GeomObject.getGeom(dg.graph), 'fdp_bug')
})

test('brandes', () => {
  const path = 'graphvis/'

  for (let i = 0; i < sortedList.length && i < 100; i++) {
    if (i !== 44) continue
    const f = sortedList[i]
    if (f.match('big(.*).gv')) continue // the parser bug
    // pmpipe.gv = sortedList[21] fails
    let dg: DrawingGraph
    try {
      const ss = new SugiyamaLayoutSettings()
      ss.BrandesThreshold = 1
      dg = runLayout(join(path, f), ss)
    } catch (Error) {
      console.log('i = ' + i + ', file = ' + f + ' error:' + Error.message)
      expect(1).toBe(0)
    }
    if (dg != null) {
      // SvgDebugWriter.writeGeomGraph('/tmp/' + f + 'brandes.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
    }
  }
})

test('layout first 75 gv files from list', () => {
  const path = 'graphvis/'
  let i = 0
  for (const f of sortedList) {
    if (f.match('big(.*).gv')) continue // the parser bug
    //console.log(f)
    if (i++ > 75) return
    let dg: DrawingGraph
    try {
      dg = runLayout(join(path, f))
    } catch (Error) {
      // console.log(f + ' error:' + Error.message)
      expect(1).toBe(0)
    }
    if (dg != null) {
      // SvgDebugWriter.writeGeomGraph('/tmp/' + f + '.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
    }
  }
})
test('shapes', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/pgram.gv'))
  createGeometry(dg, measureTextSize)
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(GeomObject.getGeom(dg.graph) as GeomGraph, ss, new CancelToken())
  ll.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/pgram.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
})

xtest('layout all gv files', () => {
  const path = 'graphvis/'
  fs.readdir(path, (err, files) => {
    expect(err).toBe(null)
    for (const f of files) {
      if (!f.match('(.*).gv')) continue
      if (f.match('big.gv')) continue

      const fname = join(path, f)
      const dg = runLayout(fname)
      if (dg != null) {
        // SvgDebugWriter.writeGeomGraph('/tmp/all' + f + '.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
      }
    }
  })
})

function duplicateDisconnected(g: GeomGraph, suffix: string) {
  const nodes: GeomNode[] = Array.from(g.shallowNodes)
  const edges: GeomEdge[] = Array.from(g.edges())
  for (const n of nodes) {
    setNode(g, n.node.id + suffix, 10, 10)
  }
  for (const e of edges) {
    g.setEdge(e.source.id + suffix, e.target.id + suffix)
  }
}

function crossed(u: GeomEdge, v: GeomEdge): boolean {
  const r = LineSegment.IntersectPPPP(u.source.center, u.target.center, v.source.center, v.target.center)
  if (r) {
    return LineSegment.xIsBetweenPoints(u.source.center, u.target.center, r)
  }
  return false
}

function createGeometry(dg: DrawingGraph, measureTextSize: (text: string, opts: Partial<TextMeasurerOptions>) => Size): GeomGraph {
  dg.createGeometry(measureTextSize)
  return <GeomGraph>GeomObject.getGeom(dg.graph)
}

xtest('large clipWithRect', () => {
  const graph = parseJSONFile('JSONfiles/gameofthrones_with_geometry.JSON')
  const geomEdges = Array.from(graph.deepEdges).map((e) => <GeomEdge>GeomEdge.getGeom(e))
  //  testEdgeCurve(geomEdges[359].curve, GeomGraph.getGeom(graph).boundingBox)
  for (let i = 0; i < geomEdges.length; i++) {
    console.log(i)
    testEdgeCurve(geomEdges[i].curve, GeomGraph.getGeom(graph).boundingBox)
  }
})

test('clipWithRect', () => {
  const dg = runLayout('graphvis/awilliams.gv', new SugiyamaLayoutSettings())
  const arr = Array.from(dg.graph.deepEdges)
  const e = arr[0]
  //for (const e of ) {
  testEdgeCurve((GeomEdge.getGeom(e) as GeomEdge).curve, GeomGraph.getGeom(dg.graph).boundingBox)
  // }
})

xtest('arcsClipWithRect', () => {
  const ss = new SugiyamaLayoutSettings()
  ss.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
  const dg = runLayout('graphvis/awilliams.gv', ss)
  const es = Array.from(dg.graph.deepEdges)
  for (let i = 0; i < es.length; i++) {
    const e = es[i]
    testEdgeCurve((GeomEdge.getGeom(e) as GeomEdge).curve, GeomGraph.getGeom(dg.graph).boundingBox)
  }
})

function* subtiles(tile: Rectangle): IterableIterator<Rectangle> {
  const c = tile.center
  const leftTop = new Rectangle({left: tile.left, bottom: c.y, right: c.x, top: tile.top})
  yield leftTop
  const righTop = new Rectangle({left: c.x, bottom: c.y, right: tile.right, top: tile.top})
  yield righTop
  const leftBottom = new Rectangle({left: tile.left, bottom: tile.bottom, right: c.x, top: c.y})
  yield leftBottom
  const rightBottom = new Rectangle({left: c.x, bottom: tile.bottom, right: tile.right, top: c.y})
  yield rightBottom
}

function testEdgeCurve(curve: ICurve, rect: Rectangle) {
  const tiles = Array.from(subtiles(rect))
  const upperLeverSegs = Array.from(clipWithRectangle(curve, rect))
  for (let i = 0; i < upperLeverSegs.length; i++) {
    const seg = upperLeverSegs[i]
    // const contains = rect.containsRectWithPadding(seg.boundingBox, rect.diagonal / 3)
    // if (!contains) {
    //   SvgDebugWriter.dumpDebugCurves(
    //     '/tmp/clipfailCont.svg',
    //     [DebugCurve.mkDebugCurveTWCI(100, 1, 'Blue', curve), DebugCurve.mkDebugCurveTWCI(100, 1, 'Red', seg)].concat(
    //       tiles.map((t) => DebugCurve.mkDebugCurveTWCI(100, 1, 'Black', t.perimeter())),
    //     ),
    //   )
    // }
    // if (calls === 478311) {
    //   setDump(true)
    // }
    // expect(contains).toBe(true)
    const subSegs = []
    for (let ii = 0; ii < tiles.length; ii++) {
      const tile = tiles[ii]
      for (const ss of clipWithRectangle(seg, tile)) {
        subSegs.push(ss)
      }
    }

    const canAssemble = canAssembleBack(rect, seg, subSegs)

    if (!canAssemble) {
      SvgDebugWriter.dumpDebugCurves(
        '/tmp/clipfail.svg',
        [DebugCurve.mkDebugCurveTWCI(100, 1, 'Red', seg)]
          .concat(tiles.map((t) => DebugCurve.mkDebugCurveTWCI(100, 1, 'Black', t.perimeter())))
          .concat(subSegs.map((s) => DebugCurve.mkDebugCurveTWCI(100, 1, 'Green', s))),
      )
    }
    expect(canAssemble).toBe(true)
  }
  if (rect.width > 100) {
    for (const tile of tiles) {
      testEdgeCurve(curve, tile)
    }
  }
}
function subsegsCoverPoint(p: Point, subSegs: ICurve[], eps: number): boolean {
  for (const seg of subSegs) {
    if (segCoverPoint(seg, p, eps)) {
      return true
    }
  }
  SvgDebugWriter.dumpDebugCurves(
    '/tmp/subsecCoverFail.svg',
    [DebugCurve.mkDebugCurveTWCI(100, 1, 'Red', CurveFactory.mkCircle(eps, p))].concat(
      subSegs.map((s) => DebugCurve.mkDebugCurveTWCI(100, 1, 'Green', s)),
    ),
  )
  return false
}
function canAssembleBack(rect: Rectangle, upperLeverSeg: ICurve, subSegs: ICurve[]): boolean {
  const n = 100
  const eps = rect.diagonal / 100
  const del = parameterSpan(upperLeverSeg) / n
  for (let i = 0; i <= 100; i++) {
    const p = upperLeverSeg.value(upperLeverSeg.parStart + del * i)
    if (rect.containsWithPadding(p, -1)) {
      if (!subsegsCoverPoint(p, subSegs, eps)) {
        return false
      }
    }
  }
  return true
}
function segCoverPoint(c: ICurve, p: Point, eps: number): boolean {
  const n = 100
  if (c instanceof Curve) {
    for (const s of c.segs) {
      const del = parameterSpan(s) / n
      for (let i = 0; i <= n; i++) {
        if (s.value(s.parStart + i * del).sub(p).length < eps) return true
      }
    }
  } else {
    const del = parameterSpan(c) / n

    for (let i = 0; i <= n; i++) {
      if (c.value(c.parStart + i * del).sub(p).length < eps) return true
    }
  }
  return false
}
