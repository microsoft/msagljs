import {TextMeasurerOptions} from '../../../src/drawing/color'
import {DrawingGraph} from '../../../src/drawing/drawingGraph'
import {GeomEdge, GeomGraph, GeomNode} from '../../../src/layout/core'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {FastIncrementalLayout} from '../../../src/layout/incremental/fastIncrementalLayout'
import {FastIncrementalLayoutSettings} from '../../../src/layout/incremental/fastIncrementalLayoutSettings'
import {CurveFactory, Point, Rectangle, Size} from '../../../src/math/geometry'
import {Edge, Graph, Node, routeEdges} from '../../../src'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'
import {parseDotGraph, measureTextSize} from '../../utils/testUtils'
import {InitialLayout} from '../../../src/layout/initialLayout/initialLayout'

function createGeometry(dg: DrawingGraph, measureTextSize: (text: string, opts: Partial<TextMeasurerOptions>) => Size): GeomGraph {
  dg.createGeometry(measureTextSize)
  return <GeomGraph>GeomObject.getGeom(dg.graph)
}
xtest('fil', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/clust.gv'))
  if (dg == null) return null
  const gg = createGeometry(dg, measureTextSize)
  const filSettings = new FastIncrementalLayoutSettings()
  filSettings.AvoidOverlaps = true
  const fil = new FastIncrementalLayout(gg, filSettings, 2, () => filSettings)
  fil.run()
  new SvgDebugWriter('/tmp/fil.svg').writeGeomGraph(gg)
})

test('initialfil', () => {
  const graph: Graph = new Graph()
  const nodes = []
  for (let i = 0; i < 50; i++) {
    const n = new Node(i.toString())
    graph.addNode(n)
    nodes.push(n)
    const gn = new GeomNode(n)
    gn.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(50, 50, 5, 5, new Point(0, 0))
  }
  for (let i = 0; i < graph.shallowNodeCount; i++)
    for (let j = i + graph.shallowNodeCount / 2; j < graph.shallowNodeCount; j++) {
      const e = new Edge(nodes[i], nodes[j])
      new GeomEdge(e)
    }
  const gg = new GeomGraph(graph)
  const filSettings = new FastIncrementalLayoutSettings()
  filSettings.AvoidOverlaps = true
  const ir = new InitialLayout(gg, filSettings)
  ir.run()

  routeEdges(gg, Array.from(gg.deepEdges), null)
  new SvgDebugWriter('/tmp/fil1.svg').writeGeomGraph(gg)
  const n = new Node('diamond')
  const gn = new GeomNode(n)
  gn.boundaryCurve = CurveFactory.CreateDiamond(200, 200, new Point(350, 230))
  graph.addNode(n)
  let e = new Edge(n, nodes[42])
  e = new Edge(n, nodes[6])
  const settings = new FastIncrementalLayoutSettings()
  settings.algorithm = new FastIncrementalLayout(gg, settings, settings.maxConstraintLevel, () => settings)
  settings.Unconverge()
  settings.CreateLockNR(gn, Rectangle.mkPP(new Point(200, 400), new Point(500, 100)))
  do {
    settings.IncrementalRunG(gg)
  } while (!settings.Converged)

  routeEdges(gg, Array.from(gg.deepEdges), null)

  new SvgDebugWriter('/tmp/fil2.svg').writeGeomGraph(gg)
})
