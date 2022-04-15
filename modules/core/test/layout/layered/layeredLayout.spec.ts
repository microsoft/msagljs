import {SortedMap} from '@esfx/collections-sortedmap'

import {StringBuilder} from 'typescript-string-operations'

import {join} from 'path'
import * as fs from 'fs'

import {sortedList} from '../sortedBySizeListOfgvFiles'

import {labelRectFunc, outputGraph, edgeString, parseDotGraph, setNode} from '../../utils/testUtils'
import {
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
} from '../../../src'
import {DrawingGraph} from '../../../src/drawing'
import {parseDot} from '@msagl/parser'
import {Arrowhead} from '../../../src/layout/core/arrowhead'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {LineSegment} from '../../../src/math/geometry'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'
import {layoutGraphWithSugiayma} from '../../../src/layout/layered/layeredLayout'
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
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/self.svg')
  t.writeGeomGraph(g)
})

test('layered layout glued graph', () => {
  const graphString = 'digraph G {\n' + 'a -> b\n' + 'a -> b}'
  const graph = parseDot(graphString)
  const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  createGeometry(dg, labelRectFunc)
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
  expect(m.size == 3)
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
  for (const n of g.shallowNodes()) {
    const s = n.id + ', center = ' + n.center
    strB.AppendLine(s)
  }
  strB.AppendLine('edges')
  for (const e of g.edges()) {
    strB.AppendLine(edgeString(e, true)) // true to get an array of poins
  }

  //  console.log(strB.ToString())
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/disconnected.svg')
  t.writeGeomGraph(g)
})

test('margins', () => {
  const dg = parseDotGraph('graphvis/abstract.gv')
  createGeometry(dg, labelRectFunc)
  const ss = new SugiyamaLayoutSettings()
  ss.margins = {left: 100, right: 10, top: 170, bottom: 50}
  const ll = new LayeredLayout(GeomObject.getGeom(dg.graph) as GeomGraph, ss, new CancelToken())
  ll.run()
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/abstract_margins_' + ss.margins.left + '_' + ss.margins.top + '.svg')
  t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
})

test('undirected pach', () => {
  const dg = parseDotGraph('graphvis/pack.gv')
  createGeometry(dg, labelRectFunc)
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(GeomObject.getGeom(dg.graph) as GeomGraph, ss, new CancelToken())
  ll.run()
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/undir_pack.svg')
  t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
})

xtest('austin', () => {
  const dg = parseDotGraph('C:/Users/levnach/Downloads/dots/tesla-processes.dot')
  createGeometry(dg, labelRectFunc)
  const gg = GeomGraph.getGeom(dg.graph)
  layoutGraphWithSugiayma(gg)
  for (const e of gg.deepEdges()) {
    expect(e.curve == null).toBe(false)
  }
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/teslaprocesses..svg')
  t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
})

test('clust.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/clust.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/clust_.gv.svg')
  t.writeGeomGraph(<GeomGraph>GeomObject.getGeom(dg.graph))
})

test('clust5.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/clust5.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/clust5_.svg')
  t.writeGeomGraph(<GeomGraph>GeomObject.getGeom(dg.graph))
})

test('b56.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/b56.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/b56.svg')
  t.writeGeomGraph(<GeomGraph>GeomObject.getGeom(dg.graph))
})

test('smlred.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/smlred.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/smlredLayered.svg')
  t.writeGeomGraph(<GeomGraph>GeomObject.getGeom(dg.graph))
})

test('b51.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/b51.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/b51Layered.svg')
  t.writeGeomGraph(<GeomGraph>GeomObject.getGeom(dg.graph))
})

test('arrowhead size default', () => {
  const dg = parseDotGraph('graphvis/abstract.gv')
  Arrowhead.defaultArrowheadLength *= 2
  const geomGraph = createGeometry(dg, labelRectFunc)
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(geomGraph, ss, new CancelToken())
  ll.run()
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/longArrows.svg')
  t.writeGeomGraph(<GeomGraph>GeomObject.getGeom(dg.graph))
})

test('arrowhead size per edge', () => {
  const dg = parseDotGraph('graphvis/abstract.gv')
  const geomGraph = createGeometry(dg, labelRectFunc)
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
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/arrowheadLength.svg')
  t.writeGeomGraph(geomGraph)
})

test('graphvis/ER.gv', () => {
  const dg = parseDotGraph('graphvis/ER.gv')
  if (dg == null) return
  createGeometry(dg, labelRectFunc)
})

test('b.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  ss.BrandesThreshold = 1
  const dg = runLayout('graphvis/b.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/btest.svg')
  t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
})
test('b7.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  ss.BrandesThreshold = 1
  const dg = runLayout('graphvis/b.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/b7test.svg')
  t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
})
xtest('fsm.gv with Brand', () => {
  const ss = new SugiyamaLayoutSettings()
  ss.BrandesThreshold = 1
  const dg = runLayout('graphvis/fsm.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/fsmbrandes.svg')
  t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
  // console.log(qualityMetric(GeomObject.getGeom(dg.graph) as GeomGraph))
})
test('fsm.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/fsm.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/fsmNetworkSimplex.svg')
  t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
})

xtest('b100', () => {
  const dg = runLayout('graphvis/b100.gv')
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/b100.svg')
  t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
})
test('pmpipe.gv', () => {
  const dg = runLayout('graphvis/pmpipe.gv')
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/pmpipe.svg')
  t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
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
      if (e == u) continue
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
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/nodes_only.svg')
  t.writeGeomGraph(g)
})

function runLayout(fname: string, settings: SugiyamaLayoutSettings = null) {
  const dg = parseDotGraph(fname)
  if (dg == null) return null
  const gg = createGeometry(dg, labelRectFunc)
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
//   fname: string,
//   ss: SugiyamaLayoutSettings = new SugiyamaLayoutSettings(),
// ) {
//   const dg = parseDotGraph(fname)
//   if (dg == null) return null
//   createGeometry(dg.graph, nodeBoundaryFunc, labelRectFunc)
//   const ll = new LayeredLayout(
//     GeomObject.getGeom(dg.graph) as GeomGraph,
//     ss,
//     new CancelToken(),
//   )

//   ll.run()

//   return dg
// }

test('root', () => {
  const fname = 'graphvis/root.gv'
  const dg = runLayout(fname)
  if (dg != null) {
    const t: SvgDebugWriter = new SvgDebugWriter('/tmp/' + 'root.svg')
    t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
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
      const t: SvgDebugWriter = new SvgDebugWriter('/tmp/' + f + 'brandes.svg')
      t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
    }
  }
})

test('layout first 150 gv files from list', () => {
  const path = 'graphvis/'
  let i = 0
  for (const f of sortedList) {
    if (f.match('big(.*).gv')) continue // the parser bug
    //console.log(f)
    if (i++ > 150) return
    let dg: DrawingGraph
    try {
      dg = runLayout(join(path, f))
    } catch (Error) {
      // console.log(f + ' error:' + Error.message)
      expect(1).toBe(0)
    }
    if (dg != null) {
      const t: SvgDebugWriter = new SvgDebugWriter('/tmp/' + f + '.svg')
      t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
    }
  }
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
        const t: SvgDebugWriter = new SvgDebugWriter('/tmp/all' + f + '.svg')
        t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
      }
    }
  })
})

function duplicateDisconnected(g: GeomGraph, suffix: string) {
  const nodes: GeomNode[] = Array.from(g.shallowNodes())
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

function createGeometry(dg: DrawingGraph, labelRectFunc: (text: string) => Size): GeomGraph {
  dg.createGeometry(labelRectFunc)
  return <GeomGraph>GeomObject.getGeom(dg.graph)
}
