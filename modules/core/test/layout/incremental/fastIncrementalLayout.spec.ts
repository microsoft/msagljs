import {TextMeasurerOptions} from '../../../src/drawing/color'
import {DrawingGraph} from '../../../src/drawing/drawingGraph'
import {GeomEdge, GeomGraph, GeomNode} from '../../../src/layout/core'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {FastIncrementalLayout} from '../../../src/layout/incremental/fastIncrementalLayout'
import {FastIncrementalLayoutSettings} from '../../../src/layout/incremental/fastIncrementalLayoutSettings'
import {CurveFactory, Point, Rectangle, Size} from '../../../src/math/geometry'
import {Edge, EdgeRoutingMode, Graph, layoutGeomGraph, Node, routeEdges} from '../../../src'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'
import {parseDotGraph, measureTextSize} from '../../utils/testUtils'
import {InitialLayout} from '../../../src/layout/initialLayout/initialLayout'

function createGeometry(dg: DrawingGraph, measureTextSize: (text: string, opts: Partial<TextMeasurerOptions>) => Size): GeomGraph {
  dg.createGeometry(measureTextSize)
  return <GeomGraph>GeomObject.getGeom(dg.graph)
}

xtest('filclust', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/clust.gv'))
  if (dg == null) return null
  const gg = createGeometry(dg, measureTextSize)
  const filSettings = new FastIncrementalLayoutSettings()
  filSettings.AvoidOverlaps = true
  const fil = new FastIncrementalLayout(gg, filSettings, 2, () => filSettings)
  fil.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/fil.svg', gg)
})

test('clust', () => {
  const graph = parseDotGraph('graphvis/clust.gv')
  const dg = DrawingGraph.getDrawingGraph(graph)

  if (dg == null) return null
  const gg = createGeometry(dg, measureTextSize)
  const settings = new FastIncrementalLayoutSettings()
  settings.maxIterations = 10
  settings.minorIterations = 20
  settings.AvoidOverlaps = true
  gg.layoutSettings = settings
  for (const subg of gg.subgraphs()) subg.layoutSettings = settings
  layoutGeomGraph(gg, null)
  // SvgDebugWriter.writeGeomGraph('/tmp/fil_clust.svg', gg)
})

test('smlred', () => {
  const graph = parseDotGraph('graphvis/smlred.gv')
  const dg = DrawingGraph.getDrawingGraph(graph)

  if (dg == null) return null
  const gg = createGeometry(dg, measureTextSize)
  const settings = new FastIncrementalLayoutSettings()
  settings.maxIterations = 10
  settings.minorIterations = 20
  settings.AvoidOverlaps = true
  gg.layoutSettings = settings
  for (const subg of gg.subgraphs()) subg.layoutSettings = settings
  layoutGeomGraph(gg, null)
  // SvgDebugWriter.writeGeomGraph('/tmp/sml_red.svg', gg)
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
  const ps = [
    new Point(-0.89200973643589165, -0.60563297356060275),
    new Point(-1.582126561847236, -0.920651196902547),
    new Point(-1.659456862064971, -0.81208558836879163),
    new Point(-1.717788462427805, -0.686082140221508),
    new Point(-1.7564535420707692, -0.545347599757541),
    new Point(-1.7750094372189196, -0.39290478550614694),
    new Point(-1.7732437090736539, -0.23202766235872829),
    new Point(-1.7511765759092697, -0.066171043532946783),
    new Point(-1.7090606815366058, 0.10110357219917887),
    new Point(-1.6473782027859123, 0.26620443781925118),
    new Point(-1.5668353291260289, 0.42558663191888257),
    new Point(-1.4683541776225937, 0.5758281182710121),
    new Point(-1.3530622358002447, 0.71370316260276567),
    new Point(-1.2222794532760126, 0.836251535029767),
    new Point(-1.0775031299496476, 0.94084201700143311),
    new Point(-0.92039077376318446, 1.025228853479554),
    new Point(-0.75274112428775553, 1.0875999418402031),
    new Point(-0.576473559394497, 1.1266157254608586),
    new Point(-0.39360612077786428, 1.1414379584046905),
    new Point(-0.20623240991188396, 1.1317477238549287),
    new Point(-0.016497618951767379, 1.0977523184229341),
    new Point(0.17342602900306048, 1.040180852309355),
    new Point(0.36136414910662396, 0.96026865651156612),
    new Point(0.54516508870418079, 0.85973082773350029),
    new Point(0.72272456100639459, 0.74072547428296076),
    new Point(0.89200973647616166, 0.60580744708192569),
    new Point(-0.72272456097875093, -0.74060559920418712),
    new Point(-0.54516508869089364, -0.85967308328887171),
    new Point(-0.36136414910853176, -0.96027667099792424),
    new Point(-0.1734260290200389, -1.0402541221492996),
    new Point(0.01649761892078061, -1.0978862398058737),
    new Point(0.20623240986883928, -1.1319338820107241),
    new Point(0.3936061207254653, -1.1416646563338873),
    new Point(0.5764735593360335, -1.1268687188996687),
    new Point(0.75274112422690109, -1.0878633342797635),
    new Point(0.92039077370376532, -1.025486095002222),
    new Point(1.0775031298953977, -0.94107694417344945),
    new Point(1.2222794532303389, -0.83644938650995115),
    new Point(1.3530622357660178, -0.71385150665260255),
    new Point(1.4683541776019666, -0.57591763388708728),
    new Point(1.5668353291202948, -0.42561169450610592),
    new Point(1.64737820279543, -0.26616347260477724),
    new Point(1.7090606815607785, -0.10099915318076924),
    new Point(1.7511765759465803, 0.066332355321350178),
    new Point(1.7732437091217577, 0.23223573110161766),
    new Point(1.7750094372747931, 0.39314653747765504),
    new Point(1.7564535421308989, 0.54560784479210156),
    new Point(1.7177884624884179, 0.68634452616785069),
    new Point(1.659456862122255, 0.81233362855539681),
    new Point(1.5821265618975957, 0.92086930605524131),
  ]
  let i = 0
  for (const n of gg.shallowNodes) {
    n.center = ps[i++]
  }
  const settings = new FastIncrementalLayoutSettings()
  settings.maxIterations = 10
  settings.minorIterations = 20
  settings.AvoidOverlaps = true
  const initialLayout = new InitialLayout(gg, settings)

  initialLayout.SingleComponent = true
  initialLayout.run()
  expect(noOverlaps(gg)).toBe(true)

  routeEdges(gg, Array.from(gg.deepEdges), null)
  // SvgDebugWriter.writeGeomGraph('/tmp/fil1.svg', gg)
  const bb = gg.pumpTheBoxToTheGraphWithMargins()
  const a = Point.middle(bb.leftTop, bb.center)
  const b = Point.middle(bb.rightBottom, bb.center)
  const smallRect = Rectangle.mkPP(a, b)

  const n = new Node('diamond')
  const gn = new GeomNode(n)

  gn.boundaryCurve = CurveFactory.CreateDiamond(smallRect.width / 2, smallRect.height / 2, smallRect.center)
  graph.addNode(n)
  let e = new Edge(n, nodes[42])
  new GeomEdge(e)
  e = new Edge(n, nodes[6])
  new GeomEdge(e)
  settings.algorithm = new FastIncrementalLayout(gg, settings, settings.maxConstraintLevel, () => settings)
  settings.Unconverge()
  settings.CreateLockNR(gn, smallRect)
  do {
    settings.IncrementalRunG(gg)
  } while (!settings.Converged)
  expect(noOverlaps(gg)).toBe(true)
  routeEdges(gg, Array.from(gg.deepEdges), null)
  // SvgDebugWriter.writeGeomGraph('/tmp/fil2.svg', gg)
})

function noOverlaps(gg: GeomGraph): any {
  const arr = Array.from(gg.shallowNodes)
  for (let i = 0; i < arr.length; i++) {
    const n = arr[i]
    for (let j = i + 1; j < arr.length; j++) {
      if (n.boundingBox.intersects(arr[j].boundingBox)) {
        return false
      }
    }
  }
  return true
}
