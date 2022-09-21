import {GeomGraph} from '../../src'
import {DrawingGraph} from '../../src/drawing/drawingGraph'
import {layoutGeomGraph} from '../../src/layout/driver'
import {SvgDebugWriter} from '../utils/svgDebugWriter'
import * as testUtils from '../utils/testUtils'

test('layoutGeomGraph', () => {
  const g = testUtils.parseDotGraph('graphvis/clust.gv')
  const dg = DrawingGraph.getDrawingGraph(g)
  dg.createGeometry((s) => testUtils.measureTextSize(s, {}))
  const geomGraph = <GeomGraph>GeomGraph.getGeom(dg.graph)
  layoutGeomGraph(geomGraph, null)
  // SvgDebugWriter.writeGeomGraph('./tmp/test_layoutGeomGraph.svg', geomGraph)
})

test('ldbxtried', () => {
  const g = testUtils.parseDotGraph('graphvis/ldbxtried.gv')
  const dg = DrawingGraph.getDrawingGraph(g)
  dg.createGeometry((s) => testUtils.measureTextSize(s, {}))
  const geomGraph = <GeomGraph>GeomGraph.getGeom(dg.graph)
  layoutGeomGraph(geomGraph, null)
  // SvgDebugWriter.writeGeomGraph('./tmp/ldbxtried.svg', geomGraph)
})
