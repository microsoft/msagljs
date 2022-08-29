import {
  Node,
  GeomGraph,
  Rectangle,
  SugiyamaLayoutSettings,
  layoutGraphWithSugiayma,
  Point,
  GeomNode,
  CurveFactory,
  Graph,
  Edge,
  MdsLayoutSettings,
  layoutGraphWithMds,
  GeomEdge,
  BundlingSettings,
} from '../../src'
import {DrawingEdge, DrawingGraph, DrawingNode} from '../../src/drawing'
import {GeomObject} from '../../src/layout/core/geomObject'
import {SplineRouter} from '../../src/routing/splineRouter'
import {sortedList} from '../layout/sortedBySizeListOfgvFiles'
import {SvgDebugWriter} from '../utils/svgDebugWriter'
import {generateRandomGeomGraph, measureTextSize, runMDSLayout, setNode} from '../utils/testUtils'
import {join} from 'path'
import {EdgeRoutingMode} from '../../src/routing/EdgeRoutingMode'
import {ArrowTypeEnum} from '../../src/drawing/arrowTypeEnum'
import {ShapeEnum} from '../../src/drawing/shapeEnum'
import {initRandom} from '../../src/utils/random'
import {EdgeRoutingSettings} from '../../src/routing/EdgeRoutingSettings'
import {PlaneTransformation} from '../../src/math/geometry/planeTransformation'

const socialNodes = [
  'Grenn',
  'Samwell',
  'Jaime',
  'Robert',
  'Tyrion',
  'Tywin',
  'Mance',
  'Oberyn',
  'Anguy',
  'Beric',
  'Bran',
  'Brynden',
  'Cersei',
  'Gendry',
  'Gregor',
  'Joffrey',
  'Jon',
  'Rickon',
  'Roose',
  'Sandor',
  'Thoros',
  'Loras',
  'Barristan',
  'Illyrio',
  'Hodor',
  'Jojen',
  'Luwin',
  'Meera',
  'Nan',
  'Theon',
  'Podrick',
  'Lothar',
  'Walder',
  'Brienne',
  'Edmure',
  'Hoster',
  'Jeyne',
  'Lysa',
  'Petyr',
  'Robb',
  'Roslin',
  'Sansa',
  'Stannis',
  'Bronn',
  'Elia',
  'Ilyn',
  'Meryn',
  'Pycelle',
  'Shae',
  'Varys',
  'Karl',
  'Drogo',
  'Irri',
  'Aegon',
  'Belwas',
  'Daario',
  'Jorah',
  'Kraznys',
  'Missandei',
  'Rakharo',
  'Rhaegar',
  'Viserys',
  'Worm',
  'Cressen',
  'Salladhor',
  'Arya',
  'Catelyn',
  'Craster',
  'Balon',
  'Qyburn',
  'Renly',
  'Tommen',
  'Alliser',
  'Bowen',
  'Kevan',
  'Margaery',
  'Myrcella',
  'Aemon',
  'Dalla',
  'Eddison',
  'Gilly',
  'Janos',
  'Melisandre',
  'Orell',
  'Qhorin',
  'Rattleshirt',
  'Styr',
  'Val',
  'Ygritte',
  'Lancel',
  'Olenna',
  'Marillion',
  'Rober',
  'Davos',
  'Ellaria',
  'Mace',
  'Ramsay',
  'Rickard',
  'Chataya',
  'Doran',
  'Aerys',
  'Amory',
  'Daenerys',
  'Eddard',
  'Jo',
  'Shireen',
  'Walton',
]

const socialEdges = [
  [77, 0],
  [77, 1],
  [100, 2],
  [100, 3],
  [100, 4],
  [100, 5],
  [72, 6],
  [101, 7],
  [65, 8],
  [65, 9],
  [65, 10],
  [65, 11],
  [65, 12],
  [65, 13],
  [65, 14],
  [65, 2],
  [65, 15],
  [65, 16],
  [65, 17],
  [65, 3],
  [65, 18],
  [65, 19],
  [65, 20],
  [65, 4],
  [68, 21],
  [54, 22],
  [54, 23],
  [9, 8],
  [9, 13],
  [9, 20],
  [10, 24],
  [10, 25],
  [10, 16],
  [10, 26],
  [10, 27],
  [10, 28],
  [10, 17],
  [10, 1],
  [10, 29],
  [33, 21],
  [43, 14],
  [43, 30],
  [11, 31],
  [11, 32],
  [66, 10],
  [66, 33],
  [66, 11],
  [66, 12],
  [66, 34],
  [66, 35],
  [66, 2],
  [66, 36],
  [66, 37],
  [66, 38],
  [66, 39],
  [66, 18],
  [66, 40],
  [66, 41],
  [66, 42],
  [66, 4],
  [66, 32],
  [12, 33],
  [12, 43],
  [12, 44],
  [12, 14],
  [12, 45],
  [12, 2],
  [12, 15],
  [12, 46],
  [12, 47],
  [12, 3],
  [12, 19],
  [12, 48],
  [12, 4],
  [12, 49],
  [67, 50],
  [55, 51],
  [55, 52],
  [102, 53],
  [102, 22],
  [102, 54],
  [102, 55],
  [102, 51],
  [102, 52],
  [102, 56],
  [102, 57],
  [102, 58],
  [102, 59],
  [102, 60],
  [102, 3],
  [102, 61],
  [102, 62],
  [93, 63],
  [93, 64],
  [103, 65],
  [103, 9],
  [103, 10],
  [103, 66],
  [103, 12],
  [103, 2],
  [103, 16],
  [103, 17],
  [103, 39],
  [103, 3],
  [103, 19],
  [103, 41],
  [79, 0],
  [34, 11],
  [34, 31],
  [34, 40],
  [34, 32],
  [13, 20],
  [80, 67],
  [14, 44],
  [14, 45],
  [14, 46],
  [14, 7],
  [14, 19],
  [24, 25],
  [24, 27],
  [35, 34],
  [52, 51],
  [2, 68],
  [2, 22],
  [2, 33],
  [2, 34],
  [2, 44],
  [2, 14],
  [2, 15],
  [2, 21],
  [2, 46],
  [2, 69],
  [2, 70],
  [2, 3],
  [2, 42],
  [2, 71],
  [2, 4],
  [81, 72],
  [81, 73],
  [81, 6],
  [15, 14],
  [15, 45],
  [15, 74],
  [15, 21],
  [15, 75],
  [15, 46],
  [15, 76],
  [15, 7],
  [15, 19],
  [15, 42],
  [15, 71],
  [15, 4],
  [25, 27],
  [25, 1],
  [16, 77],
  [16, 72],
  [16, 67],
  [16, 78],
  [16, 79],
  [16, 80],
  [16, 0],
  [16, 81],
  [16, 6],
  [16, 27],
  [16, 82],
  [16, 83],
  [16, 84],
  [16, 85],
  [16, 3],
  [16, 1],
  [16, 42],
  [16, 86],
  [16, 29],
  [16, 87],
  [16, 88],
  [104, 37],
  [104, 3],
  [56, 22],
  [56, 54],
  [56, 55],
  [56, 51],
  [74, 89],
  [74, 49],
  [21, 75],
  [21, 90],
  [31, 40],
  [26, 28],
  [37, 12],
  [37, 35],
  [37, 91],
  [37, 38],
  [37, 92],
  [37, 4],
  [37, 5],
  [6, 67],
  [6, 78],
  [6, 80],
  [6, 84],
  [6, 85],
  [6, 86],
  [6, 87],
  [6, 88],
  [27, 1],
  [82, 93],
  [82, 1],
  [46, 45],
  [58, 52],
  [76, 71],
  [76, 4],
  [7, 94],
  [7, 95],
  [30, 75],
  [85, 84],
  [70, 21],
  [70, 75],
  [70, 49],
  [60, 22],
  [60, 44],
  [60, 56],
  [60, 3],
  [97, 11],
  [17, 29],
  [39, 65],
  [39, 68],
  [39, 10],
  [39, 33],
  [39, 11],
  [39, 34],
  [39, 24],
  [39, 2],
  [39, 36],
  [39, 15],
  [39, 16],
  [39, 31],
  [39, 38],
  [39, 96],
  [39, 97],
  [39, 17],
  [39, 18],
  [39, 41],
  [39, 42],
  [39, 29],
  [39, 4],
  [39, 5],
  [39, 32],
  [3, 77],
  [3, 22],
  [3, 70],
  [3, 42],
  [3, 20],
  [92, 91],
  [18, 33],
  [1, 73],
  [1, 67],
  [1, 79],
  [1, 80],
  [1, 0],
  [1, 81],
  [1, 6],
  [1, 84],
  [19, 9],
  [19, 13],
  [19, 45],
  [19, 46],
  [19, 3],
  [19, 20],
  [41, 65],
  [41, 10],
  [41, 33],
  [41, 12],
  [41, 2],
  [41, 15],
  [41, 16],
  [41, 74],
  [41, 21],
  [41, 37],
  [41, 75],
  [41, 91],
  [41, 76],
  [41, 90],
  [41, 38],
  [41, 30],
  [41, 70],
  [41, 17],
  [41, 3],
  [41, 92],
  [41, 19],
  [41, 48],
  [41, 4],
  [48, 98],
  [48, 49],
  [105, 93],
  [42, 77],
  [42, 68],
  [42, 93],
  [42, 82],
  [42, 70],
  [42, 1],
  [71, 75],
  [4, 68],
  [4, 43],
  [4, 98],
  [4, 99],
  [4, 44],
  [4, 94],
  [4, 14],
  [4, 45],
  [4, 81],
  [4, 74],
  [4, 21],
  [4, 95],
  [4, 75],
  [4, 46],
  [4, 7],
  [4, 38],
  [4, 30],
  [4, 47],
  [4, 70],
  [4, 3],
  [4, 19],
  [4, 48],
  [4, 42],
  [4, 49],
  [5, 68],
  [5, 11],
  [5, 12],
  [5, 14],
  [5, 2],
  [5, 15],
  [5, 74],
  [5, 95],
  [5, 7],
  [5, 38],
  [5, 30],
  [5, 47],
  [5, 3],
  [5, 42],
  [5, 71],
  [5, 4],
  [5, 87],
  [5, 49],
  [5, 32],
  [87, 78],
  [49, 47],
  [61, 60],
  [61, 4],
  [32, 31],
  [32, 38],
  [32, 40],
  [106, 2],
  [88, 84],
  [88, 85],
]

test('data_social', () => {
  const g = new Graph()
  const gnodes = []
  for (const n of socialNodes) {
    const gn = new Node(n)
    gnodes.push(gn)
    g.addNode(gn)
  }
  const len = socialEdges.length
  for (let i = 0; i < len; i++) {
    const e = socialEdges[i]
    const source = gnodes[e[0]]
    const target = gnodes[e[1]]
    new Edge(source, target)
  }
  const dg = new DrawingGraph(g)
  for (const n of gnodes) {
    const dn = new DrawingNode(n)
    dn.labelText = n.id
    dn.arrowhead = ArrowTypeEnum.none
    dn.arrowtail = ArrowTypeEnum.none
    dn.shape = ShapeEnum.box
  }
  for (const e of g.edges) {
    const de = new DrawingEdge(e)
    de.directed = false
  }
  dg.createGeometry(measureTextSize)
  const gg = <GeomGraph>GeomObject.getGeom(dg.graph)
  for (const n of gg.shallowNodes) {
    n.boundaryCurve = CurveFactory.mkCircle(n.boundingBox.diagonal / 2, new Point(0, 0))
  }
  initRandom(0)
  const settings = new MdsLayoutSettings()
  settings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.None
  gg.layoutSettings = settings
  layoutGraphWithMds(gg, null)
  const sr = new SplineRouter(
    gg,
    Array.from(gg.edges()),
    // edgesToRoute.map((e) => <GeomEdge>GeomObject.getGeom(e)),
  )
  sr.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/social_bug.svg', gg)
})
test('spline router self edge', () => {
  const g = GeomGraph.mk('graph', Rectangle.mkEmpty())
  const n = setNode(g, 'a', 10, 10)
  g.setEdge('a', 'a')
  g.layoutSettings = new SugiyamaLayoutSettings()
  layoutGraphWithSugiayma(g, null) // null for the CancelToken that is ignored at the moment
  for (const e of g.edges()) {
    expect(e.curve == null).toBe(false)
  }
  g.translate(n.center.neg())
  const sr = SplineRouter.mk4(g, 2, 4, Math.PI / 6)
  sr.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/self.svg', g)
})

test('one edge', () => {
  const g = GeomGraph.mk('graph', Rectangle.mkEmpty())
  const a = setNode(g, 'a', 10, 10)
  setNode(g, 'b', 10, 10)
  g.setEdge('a', 'b')
  g.layoutSettings = new SugiyamaLayoutSettings()
  layoutGraphWithSugiayma(g, null) // null for the CancelToken that is ignored at the moment
  for (const e of g.edges()) {
    expect(e.curve == null).toBe(false)
  }
  g.translate(a.center.neg())
  const sr = SplineRouter.mk4(g, 2, 4, Math.PI / 6)
  sr.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/one_edge_sr.svg', g)
})

test('one edge with obstacle', () => {
  const g = GeomGraph.mk('graph', Rectangle.mkEmpty())
  const as = g.graph.addNode(new Node('a'))
  const bs = g.graph.addNode(new Node('b'))
  const cs = g.graph.addNode(new Node('c'))
  const a = new GeomNode(as)
  a.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 0))
  const b = new GeomNode(bs)
  b.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 200))
  const c = new GeomNode(cs)
  c.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 300))
  g.setEdge('a', 'c')
  const sr = SplineRouter.mk4(g, 2, 4, Math.PI / 6)
  sr.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/one_edge_with_obstacle.svg', g)
})
test('clust_', () => {
  let dg: DrawingGraph
  const file = 'smallGraphs/clust_.gv'
  try {
    dg = runMDSLayout(file, EdgeRoutingMode.Spline)
  } catch (Error) {
    console.log(file + ' error:' + Error.message)
    expect(1).toBe(0)
  }
  if (dg != null) {
    // SvgDebugWriter.writeGeomGraph('/tmp/clust_.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
  }
})

xtest('random circles', () => {
  for (let nodeCount = 6; nodeCount < 10; nodeCount++)
    for (let seed = 0; seed < 40; seed++) {
      const g: GeomGraph = generateRandomGeomGraph(seed, nodeCount, (w, _, xy) => CurveFactory.mkCircle(w * 0.9, xy))
      for (const n of g.graph.deepNodes) {
        n.outEdges.clear()
      }
      const nodes = Array.from(g.graph.deepNodes)
      for (let i = 0; i < nodes.length - 1; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const e = new Edge(nodes[i], nodes[j])
          new GeomEdge(e)
        }
      }
      g.transform(new PlaneTransformation(5, 0, 0, 0, 5, 0))
      const sr = SplineRouter.mk2(g, new EdgeRoutingSettings())
      sr.run()
      // SvgDebugWriter.writeGeomGraph('/tmp/circleRand' + nodeCount + 'seed' + seed + '.svg', g)
    }
})

test('layout 50-100 gv files with MDS', () => {
  const path = 'graphvis/'
  let i = 0
  for (const f of sortedList) {
    if (f.match('big(.*).gv')) continue // the parser bug
    if (++i > 100) return
    if (i < 50) continue
    let dg: DrawingGraph
    try {
      dg = runMDSLayout(join(path, f), EdgeRoutingMode.Spline)
      checkEdges(<GeomGraph>GeomObject.getGeom(dg.graph))
    } catch (Error) {
      console.log('i = ' + i + ', ' + f + ' error:' + Error.message)
      expect(1).toBe(0)
    }
    if (dg != null) {
      // SvgDebugWriter.writeGeomGraph('/tmp/splines' + f + '.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
    }
  }
})

test('layout 0-50 gv files with MDS', () => {
  const path = 'graphvis/'
  let i = 0
  for (const f of sortedList) {
    if (f.match('big(.*).gv')) continue // the parser bug
    if (++i > 50) return
    if (i !== 13) continue
    let dg: DrawingGraph
    try {
      dg = runMDSLayout(join(path, f), EdgeRoutingMode.Spline)
      checkEdges(<GeomGraph>GeomObject.getGeom(dg.graph))
    } catch (Error) {
      console.log('i = ' + i + ', ' + f + ' error:' + Error.message)
      expect(1).toBe(0)
    }
    if (dg != null) {
      // SvgDebugWriter.writeGeomGraph('/tmp/splinesPivot' + f + '.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
    }
  }
})
test('one edge with two obstacles', () => {
  const g = GeomGraph.mk('graph', Rectangle.mkEmpty())
  const as = g.graph.addNode(new Node('a'))
  const bs = g.graph.addNode(new Node('b'))
  const cs = g.graph.addNode(new Node('c'))
  const ds = g.graph.addNode(new Node('d'))
  const a = new GeomNode(as)
  a.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 0))
  const b = new GeomNode(bs)
  b.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(40, 20, 3, 3, new Point(-10, 200))
  const c = new GeomNode(cs)
  c.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(60, 20, 3, 3, new Point(35, 170))
  const d = new GeomNode(ds)
  d.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 270))
  g.setEdge('a', 'd')
  const sr = SplineRouter.mk4(g, 2, 4, Math.PI / 6)
  sr.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/one_edge_with_two_obstacles.svg', g)
})

test('edges with three obstacles', () => {
  const g = GeomGraph.mk('graph', Rectangle.mkEmpty())
  const as = g.graph.addNode(new Node('a'))
  const bs = g.graph.addNode(new Node('b'))
  const cs = g.graph.addNode(new Node('c'))
  const ds = g.graph.addNode(new Node('d'))
  const es = g.graph.addNode(new Node('e'))
  const a = new GeomNode(as)
  a.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 0))
  const b = new GeomNode(bs)
  b.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(40, 20, 3, 3, new Point(-10, 200))
  const c = new GeomNode(cs)
  c.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(60, 20, 3, 3, new Point(35, 170))
  const d = new GeomNode(ds)
  d.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 270))
  const e = new GeomNode(es)
  e.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(60, 20, 3, 3, new Point(0, 50))
  g.setEdge('a', 'd')
  g.setEdge('a', 'c')

  const sr = SplineRouter.mk4(g, 2, 4, Math.PI / 6)
  sr.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/edges_with_three_obstacles.svg', g)
})

test('two edges with obstacle', () => {
  const g = GeomGraph.mk('graph', Rectangle.mkEmpty())
  const as = g.graph.addNode(new Node('a'))
  const bs = g.graph.addNode(new Node('b'))
  const cs = g.graph.addNode(new Node('c'))
  const a = new GeomNode(as)
  a.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 0))
  const b = new GeomNode(bs)
  b.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 200))
  const c = new GeomNode(cs)
  c.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(20, 20, 3, 3, new Point(0, 300))
  g.setEdge('a', 'c')
  g.setEdge('a', 'b')
  const sr = SplineRouter.mk4(g, 2, 4, Math.PI / 6)
  sr.run()
  // SvgDebugWriter.writeGeomGraph('/tmp/two_edges_with_obstacle.svg', g)
})
function checkEdges(gg: GeomGraph) {
  for (const n of gg.deepNodesIt()) {
    for (const e of n.outEdges()) {
      expect(e.curve != null).toBe(true)
    }
    for (const e of n.selfEdges()) {
      expect(e.curve != null).toBe(true)
    }
  }
}

test('edge to a parent', () => {
  // create a graph with a subgraph and a node inside of it
  const g = new Graph('graph')
  const a = new Graph('a')
  g.addNode(a)
  const b = a.addNode(new Node('b'))
  const c = a.addNode(new Node('c'))
  const d = a.addNode(new Node('d'))
  const e = a.addNode(new Node('e'))
  const ab = new Edge(a, b)
  const ba = new Edge(b, a)
  expect(Array.from(g.deepEdges).length).toBe(2)
  // create geometry

  new GeomEdge(ab)
  new GeomEdge(ba)

  const gg = new GeomGraph(g)
  const ag = new GeomGraph(a)
  ag.boundingBox = CurveFactory.mkCircle(100, new Point(0, 0)).boundingBox

  const bg = new GeomNode(b)
  // create a smaller circle for bg
  bg.boundaryCurve = CurveFactory.mkCircle(30, new Point(0, 0))

  const cg = new GeomNode(c)
  cg.boundaryCurve = CurveFactory.mkCircle(10, new Point(-50, -50))

  const dg = new GeomNode(d)
  dg.boundaryCurve = CurveFactory.mkCircle(10, new Point(50, -50))

  const eg = new GeomNode(e)
  eg.boundaryCurve = CurveFactory.mkCircle(10, new Point(60, 0))
  {
    const sr = new SplineRouter(gg, Array.from(gg.deepEdges))
    sr.run()
    // SvgDebugWriter.writeGeomGraph('/tmp/edge_to_parent.svg', gg)
  }
  {
    const sr = new SplineRouter(gg, Array.from(gg.deepEdges))
    sr.BundlingSettings = new BundlingSettings()
    sr.run()
    // SvgDebugWriter.writeGeomGraph('/tmp/edge_to_parent_bundl.svg', gg)
  }
})
