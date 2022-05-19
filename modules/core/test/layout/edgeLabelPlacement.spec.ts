import {DrawingGraph} from '../../src/drawing/drawingGraph'
import {GeomGraph} from '../../src/layout/core'
import {GeomObject} from '../../src/layout/core/geomObject'
import {layoutGraphWithMds} from '../../src/layout/mds/PivotMDS'
import {SvgDebugWriter} from '../utils/svgDebugWriter'
import {parseDotGraph} from '../utils/testUtils'

test('fsm', () => {
  const dg = runLayout('graphvis/fsm.gv')
  const t: SvgDebugWriter = new SvgDebugWriter('/tmp/fsm_with_labels.svg')
  t.writeGeomGraph(<GeomGraph>GeomObject.getGeom(dg.graph))
})

function runLayout(fname: string): DrawingGraph {
  const dg = parseDotGraph(fname)
  dg.createGeometry()
  layoutGraphWithMds(GeomGraph.getGeom(dg.graph))
  return dg
}
