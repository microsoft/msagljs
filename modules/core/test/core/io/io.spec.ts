import {graphToJSON, parseDot, parseJSONGraph} from '../../../../parser/src/dotparser'
import {Curve, LineSegment, Point, Polyline} from '../../../src/math/geometry'
import {BezierSeg} from '../../../src/math/geometry/bezierSeg'
import {Ellipse} from '../../../src/math/geometry/ellipse'
import {measureTextSize, parseDotGraph, parseJSONFile} from '../../utils/testUtils'
import {Graph as JSONGraph} from 'dotparser'
import {GeomEdge, GeomGraph} from '../../../src/layout/core'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {SplineRouter} from '../../../src/routing/splineRouter'
import {initRandom, random} from '../../../src/utils/random'
import {DrawingGraph} from '../../../src/drawing/drawingGraph'
import {layoutGeomGraph, layoutIsCalculated} from '../../../src/layout/driver'
import {DrawingObject} from '../../../src/drawing/drawingObject'
import {DrawingNode} from '../../../src/drawing/drawingNode'
import {DrawingEdge} from '../../../src/drawing/drawingEdge'
import {layoutGraphWithSugiayma} from '../../../src/layout/layered/layeredLayout'
import {SugiyamaLayoutSettings} from '../../../src/layout/layered/sugiyamaLayoutSettings'
import {CommonLayoutSettings} from '../../../src/layout/layered/commonLayoutSettings'
import {EdgeRoutingSettings} from '../../../src/routing/EdgeRoutingSettings'
import {BundlingSettings} from '../../../src/routing/BundlingSettings'
import {PlaneTransformation} from '../../../src/math/geometry/planeTransformation'

test('point', () => {
  const p = new Point(1, 2)
  const pString = JSON.stringify(p.toJSON(), null, 2)
  const pData = JSON.parse(pString)
  const pRead = Point.fromJSON(pData)
  expect(pRead.x).toBe(1)
})
test('layout settings', () => {
  const ls = new CommonLayoutSettings()
  ls.NodeSeparation = 13
  const lsJSON = ls.toJSON()
  const newLs = CommonLayoutSettings.fromJSON(lsJSON)
  expect(newLs.NodeSeparation == 13).toBe(true)
})

test('sugiyama layout settings', () => {
  const ss = new SugiyamaLayoutSettings()
  ss.MinNodeHeight = 25
  const ssJSON = ss.toJSON()
  const newEs = SugiyamaLayoutSettings.fromJSON(ssJSON)
  expect(newEs.MinNodeHeight == 25).toBe(true)
  //expect(newEs.minimalHeight == 40).toBe(true)
})

test('edge routing settings', () => {
  const es = new EdgeRoutingSettings()
  es.ConeAngle = 25
  const esJSON = es.toJSON()
  const newEs = EdgeRoutingSettings.fromJSON(esJSON)
  expect(es.ConeAngle == newEs.ConeAngle).toBe(true)
  expect(es.bundlingSettings == null).toBe(true)
  expect(newEs.bundlingSettings == null).toBe(true)
})

test('edge routing settings and bundling settings', () => {
  const es = new EdgeRoutingSettings()
  es.ConeAngle = 25
  es.bundlingSettings = new BundlingSettings()
  es.bundlingSettings.MaxHubRadius = 20
  const esJSON = es.toJSON()

  const newEs = EdgeRoutingSettings.fromJSON(esJSON)
  expect(es.ConeAngle == newEs.ConeAngle).toBe(true)
  expect(es.bundlingSettings == null).toBe(false)
  expect(newEs.bundlingSettings.MaxHubRadius == 20).toBe(true)
})

test('lineSegment', () => {
  const line = LineSegment.mkPP(new Point(1, 2), new Point(3, 4))
  const pString = JSON.stringify(line.toJSON(), null, 2)
  const pData = JSON.parse(pString)
  const pRead = LineSegment.fromJSON(pData)
  expect(pRead.start.x).toBe(1)
  expect(pRead.end.y).toBe(4)
})

test('bezier', () => {
  let bs = BezierSeg.mkBezier([new Point(1, 2), new Point(3, 4), new Point(5, 6), new Point(7, 8)])
  const bString = JSON.stringify(bs.toJSON(), null, 2)
  const bData = JSON.parse(bString)
  bs = BezierSeg.fromJSON(bData)
  expect(bs.b[3].y).toBe(8)
})

test('ellipse', () => {
  let ellipse = new Ellipse(0.1, 3, new Point(1, 0), new Point(0, 1), new Point(3, 3))
  const eString = JSON.stringify(ellipse.toJSON(), null, 2)
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
  const eString = JSON.stringify(data, null, 2)
  const eData = JSON.parse(eString)
  curve = Curve.fromJSON(eData)
  expect(curve.end.y).toBe(4)
})

test('polyline', () => {
  let poly = Polyline.mkFromPoints([new Point(0, 0), new Point(0, 1), new Point(0, 3)])
  const data = poly.toJSON()
  const eString = JSON.stringify(data, null, 2)
  const eData = JSON.parse(eString)
  poly = Polyline.fromJSON(eData)
  expect(poly.count).toBe(3)
})

xtest('graph ldbxtried.gv', () => {
  const g = parseJSONFile('JSONfiles/ldbxtried.gv.JSON')

  const gg = GeomGraph.getGeom(g)
  gg.FlipYAndMoveLeftTopToOrigin()

  const edges = []
  for (const e of g.deepEdges) {
    if (e.source.parent !== e.target.parent) {
      const geomEdge = GeomObject.getGeom(e) as GeomEdge
      geomEdge.curve = null
      edges.push(geomEdge)
    }
  }
  initRandom(1)
  for (let i = 0; i < 32; i++) random()
  const router = new SplineRouter(gg, edges, /*tightPadding*/ 3)
  router.run()
  const w = new SvgDebugWriter('/tmp/ldbug.svg')
  w.writeGeomGraph(GeomGraph.getGeom(g))
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

test('graph fsm', () => {
  const g = parseDotGraph('graphvis/fsm.gv')
  const dg = DrawingGraph.getDrawingGraph(g)
  dg.createGeometry(measureTextSize)
  const geomGraph = GeomGraph.getGeom(g)
  layoutGraphWithSugiayma(geomGraph, null, false)
  let labelsWas = 0
  for (const e of geomGraph.deepEdges) {
    if (e.label) labelsWas++
  }
  const jsonOfGraph: JSONGraph = graphToJSON(g)

  const graph = parseJSONGraph(jsonOfGraph)
  let labelsNow = 0
  const ngg = GeomGraph.getGeom(graph)
  for (const e of ngg.deepEdges) {
    if (e.label) {
      labelsNow++
      expect(e.labelBBox.width > 0).toBe(true)
    }
  }

  expect(labelsNow).toBe(labelsWas)
  //  new SvgDebugWriter('/tmp/fsm_recovered.svg').writeGeomGraph(GeomGraph.getGeom(graph))
})

test('graph a.gv', () => {
  const g = parseDotGraph('graphvis/a.gv')
  const jsonOfG: JSONGraph = graphToJSON(g)
  const newG = parseJSONGraph(jsonOfG)
  expect(newG != null).toBe(true)
})
test('tree.gv', () => {
  const g = parseDotGraph('graphvis/tree.gv')
  const jsonOfG: JSONGraph = graphToJSON(g)
  const newG = parseJSONGraph(jsonOfG)

  expect(newG != null).toBe(true)
  const dg = <DrawingGraph>DrawingObject.getDrawingObj(newG)
  expect(dg == null).toBe(false)
  expect(dg.defaultNodeObject == null).toBe(false)
})
test('graph arrowsize', () => {
  const g = parseDotGraph('graphvis/arrowsize.gv')
  const jsonOfG: JSONGraph = graphToJSON(g)
  const newG = parseJSONGraph(jsonOfG)
  expect(newG != null).toBe(true)
})

test('directed is preserved', () => {
  let dotString = 'digraph G {\n' + 'a -> b\n' + '}'
  let graph = parseDot(dotString)
  let drawingGraph = DrawingGraph.getDrawingGraph(graph)
  expect(drawingGraph.hasDirectedEdge()).toBe(true)
  let json = graphToJSON(graph)
  let newG = parseJSONGraph(json)
  let nDrGr = DrawingGraph.getDrawingGraph(newG)
  expect(nDrGr.hasDirectedEdge()).toBe(true)

  dotString = 'graph G {\n' + 'a -- b\n' + '}'
  graph = parseDot(dotString)
  drawingGraph = DrawingGraph.getDrawingGraph(graph)
  expect(drawingGraph.hasDirectedEdge()).toBe(false)
  json = graphToJSON(graph)
  newG = parseJSONGraph(json)
  nDrGr = DrawingGraph.getDrawingGraph(newG)
  expect(nDrGr.hasDirectedEdge()).toBe(false)
})

test('measuredTextSize is preserved', () => {
  const dotString = 'digraph G {\n' + 'a -> b[label = foo]\n' + '}'
  const graph = parseDot(dotString)
  const drawingGraph = DrawingGraph.getDrawingGraph(graph)
  drawingGraph.createGeometry()
  layoutGeomGraph(GeomGraph.getGeom(graph))
  for (const n of graph.shallowNodes) {
    const dn = DrawingObject.getDrawingObj(n) as DrawingNode
    expect(dn.measuredTextSize == null).toBe(false)
  }
  for (const n of graph.deepEdges) {
    const dn = DrawingObject.getDrawingObj(n) as DrawingEdge
    expect(dn.measuredTextSize.height > 0 && dn.measuredTextSize.width > 0).toBe(true)
  }

  const boxWas = GeomGraph.getGeom(graph).boundingBox

  const json = graphToJSON(graph)
  const newGraph = parseJSONGraph(json)
  const boxBecame = GeomGraph.getGeom(newGraph).boundingBox
  expect(boxBecame.width === boxWas.width).toBe(true)
  expect(boxBecame.right === boxWas.right).toBe(true)
  expect(boxBecame.left === boxWas.left).toBe(true)
  expect(boxBecame.bottom === boxWas.bottom).toBe(true)
  for (const n of newGraph.shallowNodes) {
    const dn = DrawingObject.getDrawingObj(n) as DrawingNode
    expect(dn.measuredTextSize.height > 0 && dn.measuredTextSize.width > 0).toBe(true)
  }
  for (const n of newGraph.deepEdges) {
    const dn = DrawingObject.getDrawingObj(n) as DrawingEdge
    expect(dn.measuredTextSize.height > 0 && dn.measuredTextSize.width > 0).toBe(true)
  }
})

test('graph style', () => {
  const g = parseDotGraph('graphvis/style.gv')
  const jsonOfG: JSONGraph = graphToJSON(g)
  //const content = JSON.stringify(jsonOfG, null, 2)
  const newG = parseJSONGraph(jsonOfG)
  // const ws = fs.openSync('/tmp/style_out.JSON', 'w', 0o666)
  // fs.writeFileSync(ws, content)
  // fs.close(ws)
  expect(newG != null).toBe(true)
  const dg = DrawingGraph.getDrawingObj(newG) as DrawingGraph
  dg.createGeometry()
  layoutGeomGraph(GeomGraph.getGeom(newG))
  new SvgDebugWriter('/tmp/style.svg').writeGeomGraph(GeomGraph.getGeom(newG))
})

test('layout is loaded', () => {
  const g = parseJSONFile('JSONfiles/ldbxtried.gv.JSON')
  expect(layoutIsCalculated(g)).toBe(true)
})

test('layout settings same rank', () => {
  {
    const sugiyamaLS = new SugiyamaLayoutSettings()
    sugiyamaLS.transform = new PlaneTransformation(11, 22, 33, 44, 55, 66)
    sugiyamaLS.sameRanks = []
    sugiyamaLS.sameRanks.push(['a', 'b'])
    sugiyamaLS.sameRanks.push(['c', 'd'])
    const sjson = sugiyamaLS.toJSON()
    const jsonString = JSON.stringify(sjson)
    const nJSON = JSON.parse(jsonString)
    const nss = SugiyamaLayoutSettings.fromJSON(nJSON)
    const sameRanks = nss.sameRanks
    expect(sameRanks.length == 2).toBe(true)
    expect(sameRanks[1].length == 2).toBe(true)

    expect(sameRanks[1][1] == 'd').toBe(true)
    const tr = nss.transform
    expect(tr instanceof PlaneTransformation).toBe(true)
    expect(tr.getElem(0, 0)).toBe(11)
  }
  {
    const ss = new SugiyamaLayoutSettings()
    const ssj = ss.toJSON()
    const str = JSON.stringify(ssj)
    const json = JSON.parse(str)
    const nss = SugiyamaLayoutSettings.fromJSON(json)
    expect(nss.transform.isIdentity()).toBe(true)
  }
})
test('commonLayoutSetting are preserved', () => {
  const ss = new SugiyamaLayoutSettings()
  ss.commonLayoutSettings.NodeSeparation = 100
  ss.commonLayoutSettings.edgeRoutingSettings.ConeAngle = 22
  const ssj = ss.toJSON()
  const str = JSON.stringify(ssj)
  const json = JSON.parse(str)
  const nss = SugiyamaLayoutSettings.fromJSON(json)
  expect(nss.commonLayoutSettings.NodeSeparation).toBe(100)
  expect(nss.commonLayoutSettings.edgeRoutingSettings.ConeAngle).toBe(22)
})
