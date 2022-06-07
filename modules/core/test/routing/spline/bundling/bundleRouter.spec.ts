import {
  GeomGraph,
  Rectangle,
  GeomNode,
  CurveFactory,
  Point,
  Node,
  SugiyamaLayoutSettings,
  layoutGraphWithSugiayma,
  layoutGraphWithMds,
  MdsLayoutSettings,
  Graph,
  Edge,
  GeomEdge,
} from '../../../../src'
import {DrawingGraph} from '../../../../src/drawing/drawingGraph'
import {GeomObject} from '../../../../src/layout/core/geomObject'
import {BundlingSettings} from '../../../../src/routing/BundlingSettings'
import {EdgeRoutingMode} from '../../../../src/routing/EdgeRoutingMode'
import {EdgeRoutingSettings} from '../../../../src/routing/EdgeRoutingSettings'
import {SplineRouter} from '../../../../src/routing/splineRouter'
import {SvgDebugWriter} from '../../../utils/svgDebugWriter'
//import {SvgDebugWriter} from '../../../utils/svgDebugWriter'
import {generateRandomGeomGraph, generateRandomGeomGraphWithSubgraphs, labelRectFunc, parseDotGraph} from '../../../utils/testUtils'

test('two edges', () => {
  const g = GeomGraph.mk('graph', Rectangle.mkEmpty())
  const as = g.graph.addNode(new Node('a'))
  const bs = g.graph.addNode(new Node('b'))
  const a = new GeomNode(as)
  a.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 0))
  const b = new GeomNode(bs)
  b.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 200))
  g.setEdge('a', 'b')
  g.setEdge('a', 'b')
  const sr = SplineRouter.mk4(g, 2, 4, Math.PI / 6)

  sr.run()
  //const t: SvgDebugWriter = new SvgDebugWriter('/tmp/bundle_two_edges_with_obstacle.svg')
  // t.writeGeomGraph(g)
})

function runLayout(fname: string, settings: SugiyamaLayoutSettings = null) {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph(fname))
  if (dg == null) return null
  dg.createGeometry(labelRectFunc)
  const gg = <GeomGraph>GeomObject.getGeom(dg.graph)
  const ss: SugiyamaLayoutSettings = (gg.layoutSettings = settings ?? new SugiyamaLayoutSettings())
  if (!ss.edgeRoutingSettings) ss.edgeRoutingSettings = new EdgeRoutingSettings()
  ss.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
  layoutGraphWithSugiayma(gg, null, false)
  const sr = SplineRouter.mk4(gg, 2, 4, Math.PI / 6)
  sr.run()
  return dg
}

test('smlred.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/smlred.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/smlredLayeredBundled.svg')
  t.writeGeomGraph(<GeomGraph>GeomObject.getGeom(dg.graph))
})

test('shells.gv', () => {
  const ss = new SugiyamaLayoutSettings()
  const dg = runLayout('graphvis/shells.gv', ss)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/shellsBundled.svg')
  t.writeGeomGraph(<GeomGraph>GeomObject.getGeom(dg.graph))
})

test('random graphs', () => {
  for (let nodeCount = 7; nodeCount < 10; nodeCount++)
    for (let seed = 10; seed < 20; seed++) {
      if ((nodeCount == 7 && seed == 14) || true) {
        const gg: GeomGraph = generateRandomGeomGraph(
          seed,
          nodeCount,
          (w, h, xy) => CurveFactory.mkRectangleWithRoundedCorners(w, h, 1, 1, xy),
          2 * nodeCount,
        )
        try {
          const sr = new SplineRouter(gg, Array.from(gg.deepEdges()), 2, 4, Math.PI / 6, new BundlingSettings())
          sr.run()
        } catch {
          console.log('nodeCount=' + nodeCount + ' , seed=' + seed)
        }

        // const svgDebugWriter = new SvgDebugWriter('/tmp/bundleRand' + nodeCount + 'seed' + seed + '.svg')
        //        svgDebugWriter.writeGeomGraph(g)
      }
    }
})

xtest('brandom subgraphs 10_20', () => {
  for (let numberOfNodes = 10; numberOfNodes < 20; numberOfNodes++) {
    for (let seed = 0; seed < 5; seed++) {
      if (true || (seed == 273 && numberOfNodes == 34)) {
        try {
          const g = generateRandomGeomGraphWithSubgraphs(seed, numberOfNodes, (w, _h, p) => CurveFactory.mkCircle(w, p), numberOfNodes * 2)
          g.layoutSettings = new MdsLayoutSettings()
          g.layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.None
          layoutGraphWithMds(g, null, false)
          expect(isConsistent(g)).toBe(true)
          for (const n of g.deepNodes()) {
            n.center = round(n.center)
          }
          for (const e of g.deepEdges()) {
            e.targetArrowhead = null
          }
          g.layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
          g.layoutSettings.edgeRoutingSettings.BundlingSettings.edgeSeparation *= 2
          const edges = Array.from(g.deepEdges())
          if (edges.length == 0) continue
          const sr = new SplineRouter(g, edges)
          sr.run()
          //const svgDebugWriter = new SvgDebugWriter('/tmp/bundleSub_nodes_' + numberOfNodes + 'seed_' + seed + '.
          //svgDebugWriter.writeGeomGraph(g)
          //console.log('passed seed = ' + seed + ', number_of_nodes = ' + numberOfNodes)
        } catch {
          console.log('seed = ' + seed + ', number_of_nodes = ' + numberOfNodes)
          expect(0).toBe(1)
        }
      }
    }
  }
})

xtest('brandom subgraphs 40_50', () => {
  for (let numberOfNodes = 40; numberOfNodes < 50; numberOfNodes++) {
    for (let seed = 0; seed < 300; seed++) {
      if (true || (seed == 273 && numberOfNodes == 34)) {
        try {
          const g = generateRandomGeomGraphWithSubgraphs(seed, numberOfNodes, (w, _h, p) => CurveFactory.mkCircle(w, p), numberOfNodes * 2)
          g.layoutSettings = new MdsLayoutSettings()
          g.layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.None
          layoutGraphWithMds(g, null, false)
          expect(isConsistent(g)).toBe(true)
          for (const n of g.deepNodes()) {
            n.center = round(n.center)
          }
          for (const e of g.deepEdges()) {
            e.targetArrowhead = null
          }
          g.layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
          g.layoutSettings.edgeRoutingSettings.BundlingSettings.edgeSeparation *= 2
          const edges = Array.from(g.deepEdges())
          if (edges.length == 0) continue
          const sr = new SplineRouter(g, edges)
          sr.run()
          //const svgDebugWriter = new SvgDebugWriter('/tmp/bundleSub_nodes_' + numberOfNodes + 'seed_' + seed + '.
          // svgDebugWriter.writeGeomGraph(g)
          //console.log('passed seed = ' + seed + ', number_of_nodes = ' + numberOfNodes)
        } catch {
          console.log('seed = ' + seed + ', number_of_nodes = ' + numberOfNodes)
          expect(0).toBe(1)
        }
      }
    }
  }
})
xtest('brandom subgraphs 50_60', () => {
  for (let numberOfNodes = 50; numberOfNodes < 60; numberOfNodes++) {
    for (let seed = 0; seed < 300; seed++) {
      if (true || (seed == 273 && numberOfNodes == 34)) {
        try {
          const g = generateRandomGeomGraphWithSubgraphs(seed, numberOfNodes, (w, _h, p) => CurveFactory.mkCircle(w, p), numberOfNodes * 2)
          g.layoutSettings = new MdsLayoutSettings()
          g.layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.None
          layoutGraphWithMds(g, null, false)
          expect(isConsistent(g)).toBe(true)
          for (const n of g.deepNodes()) {
            n.center = round(n.center)
          }
          for (const e of g.deepEdges()) {
            e.targetArrowhead = null
          }
          g.layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
          g.layoutSettings.edgeRoutingSettings.BundlingSettings.edgeSeparation *= 2
          const edges = Array.from(g.deepEdges())
          if (edges.length == 0) continue
          const sr = new SplineRouter(g, edges)
          sr.run()
          //          //const svgDebugWriter = new SvgDebugWriter('/tmp/bundleSub_nodes_' + numberOfNodes + 'seed_' + seed + '.
          //          //
          //console.log('passed seed = ' + seed + ', number_of_nodes = ' + numberOfNodes)
        } catch {
          console.log('seed = ' + seed + ', number_of_nodes = ' + numberOfNodes)
          expect(0).toBe(1)
        }
      }
    }
  }
})

test('fans', () => {
  const graph = new Graph()
  const g = new GeomGraph(graph)
  const a = new Node('a')
  graph.addNode(a)
  const b = new Node('b')
  graph.addNode(b)

  const c = new Node('c')
  graph.addNode(c)

  const d = new Node('d')
  graph.addNode(d)

  const e = new Node('e')
  graph.addNode(e)

  const aGeom = new GeomNode(a)
  const bGeom = new GeomNode(b)
  const cGeom = new GeomNode(c)
  const dGeom = new GeomNode(d)
  const eGeom = new GeomNode(e)

  for (let i = 0; i < 4; i++) {
    new GeomEdge(new Edge(a, b))
  }
  for (let i = 0; i < 6; i++) {
    new GeomEdge(new Edge(a, c))
  }

  aGeom.boundaryCurve = CurveFactory.mkCircle(20, new Point(0, 0))
  bGeom.boundaryCurve = CurveFactory.mkCircle(20, new Point(200, 200))
  cGeom.boundaryCurve = CurveFactory.mkCircle(20, new Point(200, -200))
  dGeom.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(100, 150, 0, 0, new Point(90, 100))
  eGeom.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(100, 150, 0, 0, new Point(90, -100))
  g.layoutSettings = new MdsLayoutSettings()
  g.layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
  g.layoutSettings.edgeRoutingSettings.BundlingSettings.edgeSeparation *= 2
  // todo : add a check that EdgeNudger create disjoint segments inside of the hub
  const sr = new SplineRouter(g, Array.from(g.edges()))
  sr.run()
  //  const svgDebugWriter = new SvgDebugWriter('/tmp/fan.svg')
  //svgDebugWriter.writeGeomGraph(g)
})

test('brandom subgraphs 60_70', () => {
  for (let numberOfNodes = 69; numberOfNodes < 70; numberOfNodes++) {
    for (let seed = 0; seed < 1; seed++) {
      if (true || (seed == 273 && numberOfNodes == 34)) {
        try {
          const g = generateRandomGeomGraphWithSubgraphs(seed, numberOfNodes, (w, _h, p) => CurveFactory.mkCircle(w, p), numberOfNodes * 2)
          g.layoutSettings = new MdsLayoutSettings()
          g.layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.None
          layoutGraphWithMds(g, null, false)
          expect(isConsistent(g)).toBe(true)
          for (const n of g.deepNodes()) {
            n.center = round(n.center)
          }
          for (const e of g.deepEdges()) {
            e.targetArrowhead = null
          }
          g.layoutSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.SplineBundling
          g.layoutSettings.edgeRoutingSettings.BundlingSettings.edgeSeparation *= 2
          const edges = Array.from(g.deepEdges())
          if (edges.length == 0) continue
          const sr = new SplineRouter(g, edges)
          sr.run()
          //const svgDebugWriter = new SvgDebugWriter('/tmp/bundleSub_nodes_' + numberOfNodes + 'seed_' + seed + '.svg')
          //svgDebugWriter.writeGeomGraph(g)
          // console.log('passed seed = ' + seed + ', number_of_nodes = ' + numberOfNodes)
        } catch {
          console.log('seed = ' + seed + ', number_of_nodes = ' + numberOfNodes)
          expect(0).toBe(1)
        }
      }
    }
  }
})

test('cut random graphs', () => {
  const nodeCount = 7
  const seed = 14

  const g: GeomGraph = generateRandomGeomGraph(
    seed,
    nodeCount,
    (w, h, xy) => CurveFactory.mkRectangleWithRoundedCorners(w, h, 1, 1, xy),
    2 * nodeCount,
  )
  for (const n of g.deepNodes()) {
    const center = round(n.center)
    if (n instanceof GeomGraph) {
      n.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(Math.floor(n.width), Math.floor(n.height), 10, 10, center)
      n.boundingBox = n.boundaryCurve.boundingBox
    } else {
      n.center = center.add(new Point(0, 30))
    }
  }
  const ids = ['c', 'f', 'a', 'g']
  for (const n of g.deepNodes()) {
    if (ids.find((t) => n.id == t)) {
      const parent: Graph = <Graph>n.node.parent
      parent.removeNode(n.node)
    }
  }
  const bs = new BundlingSettings()
  bs.StopAfterShortestPaths = false
  const sr = new SplineRouter(g, Array.from(g.deepEdges()), 2, 4, Math.PI / 6, bs)
  sr.run()
  //const svgDebugWriter = new SvgDebugWriter('/tmp/cut.svg')
  //svgDebugWriter.writeGeomGraph(g)
})

function round(center: Point): Point {
  return new Point(Math.floor(center.x), Math.floor(center.y))
}
function isConsistent(g: GeomGraph): boolean {
  const children = Array.from(g.shallowNodes())
  for (const sg of children) {
    if (!g.boundingBox.containsRect(sg.boundingBox)) {
      return false
    }
    if (sg instanceof GeomGraph && !isConsistent(<GeomGraph>sg)) {
      return false
    }
  }
  if (boxesIntersect(children)) {
    return false
  }
  return true
}
function boxesIntersect(nodes: GeomNode[]): boolean {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].boundingBox.intersects(nodes[j].boundingBox)) {
        return true
      }
    }
  }
  return false
}
