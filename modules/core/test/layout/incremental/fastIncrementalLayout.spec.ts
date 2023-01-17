import {TextMeasurerOptions} from '../../../src/drawing/color'
import {DrawingGraph} from '../../../src/drawing/drawingGraph'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {IPsepCola} from '../../../src/layout/incremental/iPsepCola'
import {IPsepColaSetting} from '../../../src/layout/incremental/iPsepColaSettings'
import {parseDotGraph, measureTextSize, runFastIncLayout} from '../../utils/testUtils'
import {sortedList} from '../sortedBySizeListOfgvFiles'
import {join} from 'path'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'
import {GeomGraph} from '../../../src/layout/core/geomGraph'
import {layoutGeomGraph} from '../../../src/layout/driver'
import {Size} from '../../../src/math/geometry'
import {EdgeRoutingMode} from '../../../src/routing/EdgeRoutingMode'
import {AttributeRegistry} from '../../../src/structs/attributeRegistry'

function createGeometry(dg: DrawingGraph, measureTextSize: (text: string, opts: Partial<TextMeasurerOptions>) => Size): GeomGraph {
  dg.createGeometry(measureTextSize)
  return <GeomGraph>GeomObject.getGeom(dg.graph)
}

xtest('filclust', () => {
  const dg = DrawingGraph.getDrawingGraph(parseDotGraph('graphvis/clust.gv'))
  if (dg == null) return
  const gg = createGeometry(dg, measureTextSize)
  const filSettings = new IPsepColaSetting()
  filSettings.AvoidOverlaps = true
  const fil = new IPsepCola(gg, filSettings, 2)
  fil.run()
  // SvgDebugWriter.writeGeomGraph('./tmp/fil.svg', gg)
})

test('clust', () => {
  const graph = parseDotGraph('graphvis/clust.gv')
  const dg = DrawingGraph.getDrawingGraph(graph)

  if (dg == null) return
  const gg = createGeometry(dg, measureTextSize)
  const settings = new IPsepColaSetting()
  settings.maxIterations = 10
  settings.minorIterations = 20
  settings.AvoidOverlaps = true
  gg.layoutSettings = settings
  for (const subg of gg.subgraphs()) subg.layoutSettings = settings
  layoutGeomGraph(gg, null)
  // SvgDebugWriter.writeGeomGraph('./tmp/fil_clust.svg', gg)
})

test('smlred', () => {
  const graph = parseDotGraph('graphvis/smlred.gv')
  const dg = DrawingGraph.getDrawingGraph(graph)

  if (dg == null) return
  const gg = createGeometry(dg, measureTextSize)
  const settings = new IPsepColaSetting()
  settings.maxIterations = 10
  settings.minorIterations = 20
  settings.AvoidOverlaps = true
  gg.layoutSettings = settings
  for (const subg of gg.subgraphs()) subg.layoutSettings = settings
  layoutGeomGraph(gg, null)
  // SvgDebugWriter.writeGeomGraph('./tmp/sml_red.svg', gg)
})

function noOverlaps(gg: GeomGraph): any {
  const arr = Array.from(gg.shallowNodes)
  for (let i = 0; i < arr.length; i++) {
    const n = arr[i]
    for (let j = i + 1; j < arr.length; j++) {
      if (n.boundingBox.intersects(arr[j].boundingBox)) {
        return false
      }
    }
    if (n instanceof GeomGraph) {
      if (!noOverlaps(n)) return false
    }
  }
  return true
}

test('layout0-50 gv files with fil', () => {
  const path = 'graphvis/'
  let i = 0
  for (const f of sortedList) {
    if (f.match('big(.*).gv')) continue // the parser bug
    if (++i > 50) return
    if (i != 9) continue
    let dg: DrawingGraph
    try {
      dg = runFastIncLayout(join(path, f), EdgeRoutingMode.Spline)
      SvgDebugWriter.writeGeomGraph('./tmp/fil' + f + '.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
      expect(noOverlaps(dg.graph.getAttr(AttributeRegistry.GeomObjectIndex) as GeomGraph)).toBe(true)
    } catch (Error) {
      if (dg != null) {
        SvgDebugWriter.writeGeomGraph('./tmp/fil' + f + '.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
      }
      console.log('i = ' + i + ', ' + f + ' error:' + Error.message)
      expect(1).toBe(0)
    }
  }
})

test('layout100-150 gv files with fil', () => {
  const path = 'graphvis/'
  let i = 0
  for (const f of sortedList) {
    if (f.match('big(.*).gv')) continue // the parser bug
    if (++i > 150) return
    if (i < 100) continue
    // if (i != 124) continue
    let dg: DrawingGraph
    try {
      dg = runFastIncLayout(join(path, f), EdgeRoutingMode.Spline)
    } catch (Error) {
      console.log('i = ' + i + ', ' + f + ' error:' + Error.message)
      expect(1).toBe(0)
    }
    if (dg != null) {
      SvgDebugWriter.writeGeomGraph('./tmp/filinc_' + f + '.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
    }
  }
})
xtest('layout 150-250 gv files with fil', () => {
  const path = 'graphvis/'
  let i = 0
  for (const f of sortedList) {
    if (f.match('big(.*).gv')) continue // the parser bug
    if (++i > 250) return
    if (i < 150) continue
    let dg: DrawingGraph
    try {
      dg = runFastIncLayout(join(path, f), EdgeRoutingMode.Spline)
    } catch (Error) {
      console.log('i = ' + i + ', ' + f + ' error:' + Error.message)
      expect(1).toBe(0)
    }
    if (dg != null) {
      SvgDebugWriter.writeGeomGraph('./tmp/filinc_' + f + '.svg', GeomObject.getGeom(dg.graph) as GeomGraph)
    }
  }
})
