import {GeomGraph} from '../../src'
import {DrawingGraph} from '../../src/drawing/drawingGraph'
import {layoutGraphWithSugiayma} from '../../src/layout/layered/layeredLayout'
import {layoutGraphWithMds} from '../../src/layout/mds/PivotMDS'
import {measureTextSize, parseDotGraph} from '../utils/testUtils'

// xtest('drawingGraph layout', () => {
//  const abstract_gv =
//    'digraph abstract {\n' +
//    '	size="6,6";\n' +
//    '  S24 -> 27;\n' +
//    '  S24 -> 25;\n' +
//    '  S1 -> 10;\n' +
//    '  S1 -> 2;\n' +
//    '  S35 -> 36;\n' +
//    '  S35 -> 43;\n' +
//    '  S30 -> 31;\n' +
//    '  S30 -> 33;\n' +
//    '  9 -> 42;\n' +
//    '  9 -> T1;\n' +
//    '  25 -> T1;\n' +
//    '  25 -> 26;\n' +
//    '  27 -> T24;\n' +
//    '  2 -> 3;\n' +
//    '  2 -> 16;\n' +
//    '  2 -> 17;\n' +
//    '  2 -> T1;\n' +
//    '  2 -> 18;\n' +
//    '  10 -> 11;\n' +
//    '  10 -> 14;\n' +
//    '  10 -> T1;\n' +
//    '  10 -> 13;\n' +
//    '  10 -> 12;\n' +
//    '  31 -> T1;\n' +
//    '  31 -> 32;\n' +
//    '  33 -> T30;\n' +
//    '  33 -> 34;\n' +
//    '  42 -> 4;\n' +
//    '  26 -> 4;\n' +
//    '  3 -> 4;\n' +
//    '  16 -> 15;\n' +
//    '  17 -> 19;\n' +
//    '  18 -> 29;\n' +
//    '  11 -> 4;\n' +
//    '  14 -> 15;\n' +
//    '  37 -> 39;\n' +
//    '  37 -> 41;\n' +
//    '  37 -> 38;\n' +
//    '  37 -> 40;\n' +
//    '  13 -> 19;\n' +
//    '  12 -> 29;\n' +
//    '  43 -> 38;\n' +
//    '  43 -> 40;\n' +
//    '  36 -> 19;\n' +
//    '  32 -> 23;\n' +
//    '  34 -> 29;\n' +
//    '  39 -> 15;\n' +
//    '  41 -> 29;\n' +
//    '  38 -> 4;\n' +
//    '  40 -> 19;\n' +
//    '  4 -> 5;\n' +
//    '  19 -> 21;\n' +
//    '  19 -> 20;\n' +
//    '  19 -> 28;\n' +
//    '  5 -> 6;\n' +
//    '  5 -> T35;\n' +
//    '  5 -> 23;\n' +
//    '  21 -> 22;\n' +
//    '  20 -> 15;\n' +
//    '  28 -> 29;\n' +
//    '  6 -> 7;\n' +
//    '  15 -> T1;\n' +
//    '  22 -> 23;\n' +
//    '  22 -> T35;\n' +
//    '  29 -> T30;\n' +
//    '  7 -> T8;\n' +
//    '  23 -> T24;\n' +
//    '  23 -> T1;\n' +
//    '  }\n'
//  const dg = parseDotString(abstract_gv)
//  layoutDrawingGraph(dg)
// })
// // done for SVG

function layoutGeomGraph(geomGraph: GeomGraph, directed: boolean, flipToScreenCoords = true) {
  if (directed) {
    layoutGraphWithSugiayma(geomGraph, null, flipToScreenCoords)
  } else {
    layoutGraphWithMds(geomGraph, null, flipToScreenCoords)
  }
}
xtest('clusters', () => {
  const g = parseDotGraph('graphvis/clust3.gv')
  const dg = DrawingGraph.getDrawingObj(g) as DrawingGraph
  dg.createGeometry(measureTextSize)
  layoutGeomGraph(<GeomGraph>GeomGraph.getGeom(g), dg.hasDirectedEdge())
})
