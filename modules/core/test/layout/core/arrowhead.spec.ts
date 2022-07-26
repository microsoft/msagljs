import {GeomNode, CurveFactory, Point, Edge, GeomEdge, GeomLabel, Rectangle, Graph, GeomGraph, Node} from '../../../src'
import {Arrowhead} from '../../../src/layout/core/arrowhead'
import {LineSegment} from '../../../src/math/geometry'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'

test('trim edge no arrowheads', () => {
  const a = new Node('a')
  const ga = new GeomNode(a)
  ga.boundaryCurve = CurveFactory.mkCircle(20, new Point(0, 0))
  const b = new Node('b')
  const gb = new GeomNode(b)
  gb.boundaryCurve = CurveFactory.mkCircle(20, new Point(100, 100))

  const ab = new Edge(a, b)
  const gab = new GeomEdge(ab)
  const curve = LineSegment.mkPP(ga.center, gb.center)
  Arrowhead.trimSplineAndCalculateArrowheads(gab, curve, true)
  SvgDebugWriter.dumpICurves('/tmp/gab.svg', [gab.curve, ga.boundaryCurve, gb.boundaryCurve])
})
test('trim edge with arrowheads', () => {
  const a = new Node('a')
  const ga = new GeomNode(a)
  ga.boundaryCurve = CurveFactory.mkCircle(20, new Point(0, 0))
  const b = new Node('b')
  const gb = new GeomNode(b)
  gb.boundaryCurve = CurveFactory.mkCircle(20, new Point(100, 100))

  const ab = new Edge(a, b)
  const gab = new GeomEdge(ab)
  gab.label = new GeomLabel(Rectangle.mkPP(new Point(0, 0), new Point(10, 5)), gab)
  const m = Point.middle(ga.center, gb.center)

  gab.label.boundingBox = Rectangle.mkPP(m, m.add(new Point(10, 10)))
  const curve = LineSegment.mkPP(ga.center, gb.center)
  gab.sourceArrowhead = new Arrowhead()
  gab.targetArrowhead = new Arrowhead()
  Arrowhead.trimSplineAndCalculateArrowheads(gab, curve, true)
  const g = new Graph()
  g.addEdge(ab)
  const gg = new GeomGraph(g)
  const xw = new SvgDebugWriter('/tmp/gg.svg')
  xw.writeGeomGraph(gg)
})
