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
/*
{Microsoft.Msagl.Core.Geometry.Point[50]}
(-2.5548934049371894,-41.066780678733323)
(-146.08406196610687,-142.43934738567162)
(-89.3767649290301,-54.503330308978221)
(-56.975681507276363,-18.38338430407951)
(-13.703599739733072,-19.403466520743073)
(17.109849530586065,-40.048336087784818)
(35.320818206415076,-54.476081368272105)
(43.894678676614618,-50.083094941018324)
(62.46301257870789,-1.8318596820908484)
(57.346005908955249,-4.3263955868003992)
(43.0790079918823,-17.937669380316848)
(26.474378226762841,-18.375644085660202)
(5.2225689495901317,0.97413653728011518)
(-3.149393879289716,29.197679023045986)
(-24.285917545044313,16.207928147182997)
(-33.991375847726218,0.35696546702698129)
(-26.355182070346373,-3.0136124108114224)
(-13.995652875008027,-8.73354188222661)
(11.709417996382843,-9.7955036952414716)
(40.01416633668795,-13.06514500699091)
(41.367380352691939,-22.628810243036128)
(15.171773486859173,-65.810587974435435)
(8.4748256006203846,-49.156262057171737)
(5.9402415228782113,-31.288231560079403)
(11.163695419105338,-36.6594337382309)
(0.93732006699374892,47.540059432703913)
(-14.35616455940702,36.054686435867382)
(-8.3938589416006781,31.285425907853444)
(-7.8868523502620054,48.6630849706616)
(-13.414549882951434,64.2343891507968)
(-39.531199234973109,20.017695745296955)
(-31.838198578609564,11.779642995079719)
(0.55416423089582523,13.400884149708986)
(18.226978304327581,15.288478270193018)
(32.155762113442009,16.928749724276997)
(32.547054661294951,-0.24286122461860771)
(6.8160796522575851,-27.497441842652087)
(9.5996616950518643,-22.760748584587397)
(-5.386361271772218,-0.80740348182907873)
(-34.952581126221133,8.9561588817440612)
(-51.784149420466015,5.7577687132954996)
(-59.951168881077315,3.1939402457064112)
(-40.255221274000121,50.29181346737554)
(-41.910089978141322,55.227822809689272)
(-42.609233989371319,44.106275374004355)
(-16.842607726227111,34.19950230768675)
(14.933149686171703,15.079937173539374)
(57.673203264122,13.835860713046639)
(91.230834567669859,49.975038014045175)
(146.6053688143212,139.14462463658308)
*/
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
  const filSettings = new FastIncrementalLayoutSettings()
  filSettings.maxIterations = 10
  filSettings.minorIterations = 20
  filSettings.AvoidOverlaps = true
  const fil = new FastIncrementalLayout(gg, filSettings, 0, () => null)
  fil.run()

  new SvgDebugWriter('/tmp/filAfterInitial.svg').writeGeomGraph(gg)
  const ir = new InitialLayout(gg, filSettings)
  ir.run()

  routeEdges(gg, Array.from(gg.deepEdges), null)
  new SvgDebugWriter('/tmp/fil1.svg').writeGeomGraph(gg)
  const n = new Node('diamond')
  const gn = new GeomNode(n)
  gn.boundaryCurve = CurveFactory.CreateDiamond(200, 200, new Point(350, 230))
  graph.addNode(n)
  new Edge(n, nodes[42])
  new Edge(n, nodes[6])
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
