import {TextMeasurerOptions} from '../../../src/drawing/color'
import {DrawingGraph} from '../../../src/drawing/drawingGraph'
import {GeomGraph} from '../../../src/layout/core'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {FastIncrementalLayout} from '../../../src/layout/incremental/fastIncrementalLayout'
import {FastIncrementalLayoutSettings} from '../../../src/layout/incremental/fastIncrementalLayoutSettings'
import {Size} from '../../../src/math/geometry'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'
import {parseDotGraph, measureTextSize} from '../../utils/testUtils'

function createGeometry(dg: DrawingGraph, measureTextSize: (text: string, opts: Partial<TextMeasurerOptions>) => Size): GeomGraph {
  dg.createGeometry(measureTextSize)
  return <GeomGraph>GeomObject.getGeom(dg.graph)
}
test('fil', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/clust.gv'))
  if (dg == null) return null
  const gg = createGeometry(dg, measureTextSize)
  const filSettings = new FastIncrementalLayoutSettings()
  const fil = new FastIncrementalLayout(gg, filSettings, 2, () => filSettings)
  fil.run()
  new SvgDebugWriter('/tmp/fil.svg').writeGeomGraph(gg)
})
