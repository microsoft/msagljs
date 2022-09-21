import {DrawingGraph} from '../../src/drawing/drawingGraph'
import {GeomGraph} from '../../src/layout/core'
import {GeomObject} from '../../src/layout/core/geomObject'
import {layoutGraphWithMds} from '../../src/layout/mds/pivotMDS'
import {SvgDebugWriter} from '../utils/svgDebugWriter'
import {parseDotGraph} from '../utils/testUtils'

test('fsm', () => {
  const dg = runLayout('graphvis/fsm.gv')
  // SvgDebugWriter.writeGeomGraph('./tmp/fsm_with_labels.svg', <GeomGraph>GeomObject.getGeom(dg.graph))
})

function runLayout(fname: string): DrawingGraph {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph(fname))
  dg.createGeometry()
  layoutGraphWithMds(GeomGraph.getGeom(dg.graph))
  return dg
}
