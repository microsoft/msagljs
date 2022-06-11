import {graphToJSON, parseJSONGraph} from '../../../../parser/src/dotparser'
import {Curve, LineSegment, Point, Polyline} from '../../../src/math/geometry'
import {BezierSeg} from '../../../src/math/geometry/bezierSeg'
import {Ellipse} from '../../../src/math/geometry/ellipse'
import {parseDotGraph, parseJSONFile} from '../../utils/testUtils'
import {Graph as JSONGraph} from 'dotparser'
import {DrawingGraph} from '../../../src/drawing/drawingGraph'
import {layoutGeomGraph} from '../../../src/layout/driver'
import {GeomGraph} from '../../../src/layout/core'
test('point', () => {
  const p = new Point(1, 2)
  const pString = JSON.stringify(p.toJSON())
  const pData = JSON.parse(pString)
  const pRead = Point.fromJSON(pData)
  expect(pRead.x).toBe(1)
})

test('lineSegment', () => {
  const line = LineSegment.mkPP(new Point(1, 2), new Point(3, 4))
  const pString = JSON.stringify(line.toJSON())
  const pData = JSON.parse(pString)
  const pRead = LineSegment.fromJSON(pData)
  expect(pRead.start.x).toBe(1)
  expect(pRead.end.y).toBe(4)
})

test('bezier', () => {
  let bs = BezierSeg.mkBezier([new Point(1, 2), new Point(3, 4), new Point(5, 6), new Point(7, 8)])
  const bString = JSON.stringify(bs.toJSON())
  const bData = JSON.parse(bString)
  bs = BezierSeg.fromJSON(bData)
  expect(bs.b[3].y).toBe(8)
})

test('ellipse', () => {
  let ellipse = new Ellipse(0.1, 3, new Point(1, 0), new Point(0, 1), new Point(3, 3))
  const eString = JSON.stringify(ellipse.toJSON())
  const eData = JSON.parse(eString)
  ellipse = Ellipse.fromJSON(eData)
  expect(ellipse.center.y).toBe(3)
  const a = Math.PI / 3
  expect(Point.closeDistEps(ellipse.value(a), ellipse.center.add(ellipse.aAxis.mul(Math.cos(a))).add(ellipse.bAxis.mul(Math.sin(a)))))
})
test('curve', () => {
  let curve = new Curve()
  curve.addSegment(new LineSegment(0, 1, 2, 3))
  curve.addSegment(new BezierSeg(new Point(2, 3), new Point(3, 4), new Point(3, 3), new Point(5, 4)))
  const data = curve.toJSON()
  const eString = JSON.stringify(data)
  const eData = JSON.parse(eString)
  curve = Curve.fromJSON(eData)
  expect(curve.end.y).toBe(4)
})

test('polyline', () => {
  let poly = Polyline.mkFromPoints([new Point(0, 0), new Point(0, 1), new Point(0, 3)])
  const data = poly.toJSON()
  const eString = JSON.stringify(data)
  const eData = JSON.parse(eString)
  poly = Polyline.fromJSON(eData)
  expect(poly.count).toBe(3)
})

test('graph ldbxtried.gv', () => {
  const g = parseJSONFile('JSONfiles/ldbxtried.gv.JSON')
  expect(g.isConsistent()).toBe(true)
  DrawingGraph.getDrawingGraph(g).createGeometry()
  layoutGeomGraph(GeomGraph.getGeom(g) as GeomGraph)
  const parsedGraph: JSONGraph = graphToJSON(g)

  const graph = parseJSONGraph(parsedGraph)
  expect(graph.isConsistent()).toBe(true)
  const subgraphs = Array.from(graph.subgraphs())
  expect(subgraphs.length).toBe(Array.from(g.subgraphs()).length)
  expect(graph.nodeCountDeep).toBe(g.nodeCountDeep)
})

test('graph smlred', () => {
  const g = parseDotGraph('graphvis/smlred.gv')
  const subgraphsWas = Array.from(g.subgraphs()).length
  const nodesWas = g.nodeCountDeep
  const parsedGraph: JSONGraph = graphToJSON(g)

  const graph = parseJSONGraph(parsedGraph)
  const subgraphs = Array.from(graph.subgraphs())
  expect(subgraphs.length).toBe(subgraphsWas)
  expect(graph.nodeCountDeep).toBe(nodesWas)
})

test('graph a.gv', () => {
  const g = parseDotGraph('graphvis/a.gv')
  const subgraphsWas = Array.from(g.subgraphs()).length
  const nodesWas = g.nodeCountDeep
  const parsedGraph: JSONGraph = graphToJSON(g)

  const graph = parseJSONGraph(parsedGraph)
  const subgraphs = Array.from(graph.subgraphs())
  expect(subgraphs.length).toBe(subgraphsWas)
  expect(graph.nodeCountDeep).toBe(nodesWas)
})
