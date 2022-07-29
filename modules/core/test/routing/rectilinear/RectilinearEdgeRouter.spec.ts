import {join} from 'path'
import {GeomGraph, Graph, CurveFactory, Point, GeomEdge, Edge, ICurve, GeomNode, Node, Rectangle, routeRectilinearEdges} from '../../../src'
import {DrawingGraph} from '../../../src/drawing'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {EdgeRoutingMode} from '../../../src/routing/EdgeRoutingMode'
import {RectilinearEdgeRouter} from '../../../src/routing/rectilinear/RectilinearEdgeRouter'

import {sortedList} from '../../layout/sortedBySizeListOfgvFiles'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'
import {generateRandomGeomGraph, measureTextSize, runMDSLayoutNoSubgraphs} from '../../utils/testUtils'
test('empty graph', () => {
  const gg = new GeomGraph(new Graph('graph'))

  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/emptyrectr.svg')
  t.writeGeomGraph(gg)
})

test('two nodes', () => {
  const gg = new GeomGraph(new Graph('graph'))

  const size = measureTextSize('a', {})

  const a = addNode(gg, 'a', CurveFactory.mkRectangleWithRoundedCorners(size.width + 2, size.height + 2, 1, 1, new Point(150, 100)))

  const b = addNode(gg, 'b', CurveFactory.mkRectangleWithRoundedCorners(size.width + 2, size.height + 2, 1, 1, new Point(100, 0)))

  new GeomEdge(new Edge(a, b))

  const rr = RectilinearEdgeRouter.constructorGNAN(gg, null, 1, 3)
  rr.run()

  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/tworectr.svg')
  t.writeGeomGraph(gg)
})

test('three nodes', () => {
  const gg = new GeomGraph(new Graph('graph'))

  const a = addNode(gg, 'a', CurveFactory.mkRectangleWithRoundedCorners(20, 20, 1, 1, new Point(40, 0)))

  const b = addNode(gg, 'b', CurveFactory.mkRectangleWithRoundedCorners(20, 20, 1, 1, new Point(40, 80)))

  addNode(gg, 'c', CurveFactory.mkRectangleWithRoundedCorners(20, 10, 1, 1, new Point(40, 40)))

  new GeomEdge(new Edge(a, b))

  const rr = RectilinearEdgeRouter.constructorGNAN(gg, null, 1, 3)
  rr.run()

  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/threerectr.svg')
  t.writeGeomGraph(gg)
})

test('pbi', () => {
  const gg = new GeomGraph(new Graph('graph'))
  const n15 = addNode(
    gg,
    '15',
    new Rectangle({
      bottom: 647.0507127464164,
      left: 968.6009222567025,
      right: 1202.6009222567025,
      top: 919.0507127464164,
    }).perimeter(),
  )

  addNode(
    gg,
    '0',
    new Rectangle({
      bottom: 434.19031909913804,
      left: 926.6009222567027,
      right: 1160.6009222567027,
      top: 658.190319099138,
    }).perimeter(),
  )
  const n7 = addNode(
    gg,
    '7',
    new Rectangle({
      bottom: 499.87394934770634,
      left: 528.0278046812289,
      right: 762.0278046812289,
      top: 795.8739493477063,
    }).perimeter(),
  )
  //

  const n1 = addNode(
    gg,
    '1',
    new Rectangle({
      bottom: 92.54644608490526,
      left: 1765.74715740765,
      right: 1999.74715740765,
      top: 268.54644608490526,
    }).perimeter(),
  )

  const n2 = addNode(
    gg,
    '2',
    new Rectangle({
      bottom: 305.06834002769904,
      left: 1367.1740398321763,
      right: 1601.1740398321763,
      top: 605.068340027699,
    }).perimeter(),
  )
  const n3 = addNode(
    gg,
    '3',
    new Rectangle({
      bottom: 45.617201523664335,
      left: 719.7809750559751,
      right: 953.7809750559751,
      top: 269.61720152366433,
    }).perimeter(),
  )
  const n5 = addNode(
    gg,
    '5',
    new Rectangle({
      bottom: 935.8849029898761,
      left: 1367.1740398321763,
      right: 1601.1740398321763,
      top: 1235.884902989876,
    }).perimeter(),
  )

  const n11 = addNode(
    gg,
    '11',
    new Rectangle({
      bottom: 33.300831772232584,
      left: 287.5700126710578,
      right: 521.5700126710578,
      top: 333.3008317722326,
    }).perimeter(),
  )
  addNode(
    gg,
    '8',

    new Rectangle({
      bottom: 645.4325125192765,
      left: 129.45468710575506,
      right: 363.45468710575506,
      top: 845.4325125192765,
    }).perimeter(),
  )

  const n9 = addNode(
    gg,
    '9',
    new Rectangle({
      bottom: -234.95591605180942,
      left: 1040.8748448058916,
      right: 1274.8748448058916,
      top: -82.95591605180942,
    }).perimeter(),
  )
  const n18 = addNode(
    gg,
    '18',
    new Rectangle({
      bottom: -270.9559160518095,
      left: 738.5960316322725,
      right: 972.5960316322725,
      top: -94.95591605180945,
    }).perimeter(),
  )
  const n10 = addNode(
    gg,
    '10',
    new Rectangle({
      bottom: 958.44706692318,
      left: 876.9293251120572,
      right: 1110.929325112057,
      top: 1258.44706692318,
    }).perimeter(),
  )

  const n14 = addNode(
    gg,
    '14',
    new Rectangle({
      bottom: -272.3296859724199,
      left: 340.0229140567983,
      right: 574.0229140567985,
      top: -48.329685972419895,
    }).perimeter(),
  )
  //11->18
  const n13 = addNode(
    gg,
    '13',

    new Rectangle({
      bottom: 208.85939494380278,
      left: 11.312476038415667,
      right: 245.31247603841612,
      top: 456.8593949438028,
    }).perimeter(),
  )

  const n12 = addNode(
    gg,
    '12',
    new Rectangle({
      bottom: -151.96175898939126,
      left: -58.550203518675005,
      right: 175.44979648132477,
      top: 0.03824101060874341,
    }).perimeter(),
  )

  const n16 = addNode(
    gg,
    '16',
    new Rectangle({
      bottom: 1190.1989026985566,
      left: 478.3562075365835,
      right: 712.3562075365835,
      top: 1342.1989026985566,
    }).perimeter(),
  )
  const n17 = addNode(
    gg,
    '17',
    new Rectangle({
      bottom: 322.2635410883044,
      left: 528.0278046812289,
      right: 762.0278046812289,
      top: 498.2635410883044,
    }).perimeter(),
  )
  makeEdges()

  routeRectilinearEdges(gg, null, null, 25, 3)

  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/pbi.svg')
  t.writeGeomGraph(gg)

  function makeEdges() {
    addGeomEdge(n9, n18)

    addGeomEdge(n9, n11)
    addGeomEdge(n1, n2)
    addGeomEdge(n11, n15)

    // inEdges: Set(3)
    addGeomEdge(n13, n16)
    addGeomEdge(n13, n16)
    addGeomEdge(n17, n16)
    addGeomEdge(n14, n12)
    addGeomEdge(n11, n10)
    // inEdges: Set(4)
    addGeomEdge(n3, n5)

    addGeomEdge(n15, n5)

    addGeomEdge(n11, n5)
    addGeomEdge(n7, n5)
  }
})

test('four nodes', () => {
  const gg = new GeomGraph(new Graph('graph'))

  const a = addNode(gg, 'a', CurveFactory.mkRectangleWithRoundedCorners(20, 10, 1, 1, new Point(30.05000000000004, 195.94110392619666)))

  const b = addNode(gg, 'b', CurveFactory.mkRectangleWithRoundedCorners(20, 10, 1, 1, new Point(243.11507640382774, 205.0615810745058)))

  const c = addNode(gg, 'c', CurveFactory.mkRectangleWithRoundedCorners(20, 10, 1, 1, new Point(341.7503606207244, 394.1406165636244)))
  const d = addNode(gg, 'd', CurveFactory.mkRectangleWithRoundedCorners(20, 10, 1, 1, new Point(357.54294072486624, 25.099999999999994)))

  new GeomEdge(new Edge(a, b))
  new GeomEdge(new Edge(c, b))
  new GeomEdge(new Edge(b, d))

  const rr = RectilinearEdgeRouter.constructorGNAN(gg, null, 1, 3)
  rr.run()

  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/fourrectr.svg')
  t.writeGeomGraph(gg)
})

function addNode(gg: GeomGraph, id: string, c: ICurve): Node {
  const node: Node = gg.graph.addNode(new Node(id))

  const geomNodea = new GeomNode(node)
  geomNodea.boundaryCurve = c
  return node
}

function addGeomEdge(a: Node, b: Node) {
  new GeomEdge(new Edge(a, b))
}

test('6 nodes', () => {
  const gg = new GeomGraph(new Graph('graph'))
  const coords = nodeCoords()
  const a = getNode(0)
  const b = getNode(1)
  const c = getNode(2)
  const d = getNode(3)
  const e = getNode(4)
  const f = getNode(5)
  new GeomEdge(new Edge(a, b))
  new GeomEdge(new Edge(a, c))
  new GeomEdge(new Edge(a, d))
  new GeomEdge(new Edge(a, e))
  new GeomEdge(new Edge(a, f))
  new GeomEdge(new Edge(e, f))
  new GeomEdge(new Edge(e, b))

  const rr = RectilinearEdgeRouter.constructorGNAN(gg, null, 1, 3)
  rr.run()

  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/sixrectr.svg')
  t.writeGeomGraph(gg)

  function getNode(i: number) {
    const n = addNode(gg, coords[i].id, CurveFactory.mkRectangleWithRoundedCorners(20, 10, 1, 1, new Point(coords[i].x, coords[i].y)))
    return n
  }

  function nodeCoords() {
    return [
      {id: 'a', x: 246, y: 250},
      {id: 'b', x: 240, y: 25},
      {id: 'c', x: 383, y: 430},
      {id: 'd', x: 118, y: 436},
      {id: 'e', x: 30, y: 186},
      {id: 'f', x: 459, y: 175},
    ]
  }
})
test('first 50 dot files', () => {
  const path = 'graphvis/'
  let i = 0
  for (const f of sortedList) {
    if (f.match('big(.*).gv')) continue // the parser bug
    // ++i
    if (++i !== 33) continue

    let dg: DrawingGraph
    try {
      dg = runMDSLayoutNoSubgraphs(join(path, f), EdgeRoutingMode.Rectilinear)
    } catch (Error) {
      console.log('i = ' + i + ', ' + f + ' error:' + Error.message)
      expect(1).toBe(0)
    }
    if (dg != null) {
      const t: SvgDebugWriter = new SvgDebugWriter('/tmp/' + f + 'rect.svg')
      t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
    }
    if (i > 50) return
  }
})

test('random rect', () => {
  for (let nodeCount = 3; nodeCount < 7; nodeCount++)
    for (let seed = 0; seed < 7; seed++) {
      const gg: GeomGraph = generateRandomGeomGraph(seed, nodeCount)
      const rr = RectilinearEdgeRouter.constructorGNAN(gg, null, 1, 3)
      rr.run()
      const svgDebugWriter = new SvgDebugWriter('/tmp/rand' + nodeCount + 'seed' + seed + '.svg')
      svgDebugWriter.writeGeomGraph(gg)
    }
})

test('layout 100-150 gv files with MDS rect', () => {
  const path = 'graphvis/'
  let i = 0
  for (const f of sortedList) {
    if (f.match('big(.*).gv')) continue // the parser bug
    if (++i > 150) return
    if (i < 100) continue
    if (i !== 108) continue
    let dg: DrawingGraph

    try {
      dg = runMDSLayoutNoSubgraphs(join(path, f), EdgeRoutingMode.Rectilinear)
    } catch (Error) {
      console.log('i=' + i + ', file=' + f + ' error:' + Error.message)
      expect(1).toBe(0)
    }
    if (dg != null) {
      const t: SvgDebugWriter = new SvgDebugWriter('/tmp/rect' + f + '.svg')
      t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
    }
  }
})

test('abstract rect', () => {
  const path = 'graphvis/'
  let dg: DrawingGraph
  try {
    dg = runMDSLayoutNoSubgraphs(join(path, 'abstract.gv'), EdgeRoutingMode.Rectilinear)
  } catch (Error) {
    console.log('abstract.gv' + ' error:' + Error.message)
    expect(1).toBe(0)
  }
  if (dg != null) {
    const t: SvgDebugWriter = new SvgDebugWriter('/tmp/rect' + 'abstract' + '.svg')
    t.writeGeomGraph(GeomObject.getGeom(dg.graph) as GeomGraph)
  }
})
