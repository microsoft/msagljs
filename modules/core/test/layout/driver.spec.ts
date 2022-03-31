import {GeomGraph} from '../../src'
import {layoutGeomGraph} from '../../src/layout/driver'
import {SvgDebugWriter} from '../utils/svgDebugWriter'
import {parseDotGraph, createGeometry, nodeBoundaryFunc, labelRectFunc} from '../utils/testUtils'

test('layoutGeomGraph', () => {
  const dg = parseDotGraph('graphvis/clust.gv')
  createGeometry(dg.graph, nodeBoundaryFunc, labelRectFunc)
  const geomGraph = <GeomGraph>GeomGraph.getGeom(dg.graph)
  layoutGeomGraph(geomGraph, null)
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/test_layoutGeomGraph.svg')
  t.writeGeomGraph(geomGraph)
})
