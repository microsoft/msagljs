import {GeomGraph} from '../../src'
import {DrawingGraph} from '../../src/drawing/drawingGraph'
import {layoutGeomGraph} from '../../src/layout/driver'
import {SvgDebugWriter} from '../utils/svgDebugWriter'
import {parseDotGraph, createGeometry, nodeBoundaryFunc, measureTextSize} from '../utils/testUtils'

test('layoutGeomGraph', () => {
  const g = parseDotGraph('graphvis/clust.gv')
  const dg = DrawingGraph.getDrawingGraph(g)
  createGeometry(dg.graph, nodeBoundaryFunc, (s) => measureTextSize(s, {}))
  const geomGraph = <GeomGraph>GeomGraph.getGeom(dg.graph)
  layoutGeomGraph(geomGraph, null)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/test_layoutGeomGraph.svg')
  t.writeGeomGraph(geomGraph)
})

test('ldbxtried', () => {
  const g = parseDotGraph('graphvis/ldbxtried.gv')
  const dg = DrawingGraph.getDrawingGraph(g)
  createGeometry(dg.graph, nodeBoundaryFunc, (s) => measureTextSize(s, {}))
  const geomGraph = <GeomGraph>GeomGraph.getGeom(dg.graph)
  layoutGeomGraph(geomGraph, null)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/ldbxtried.svg')
  t.writeGeomGraph(geomGraph)
})
