import {join} from 'path'
import * as fs from 'fs'
import {parseJSON, parseDot} from '../../../parser/src/dotparser'
import {
  GeomGraph,
  GeomEdge,
  layoutGeomGraph,
  EdgeRoutingMode,
} from '../../../core/src'
import {DrawingGraph} from '../../../drawing/src'
import {IPsepColaSetting} from '../../../core/src/layout/incremental/iPsepColaSettings'
import {Size} from '../../../core/src/math/geometry'
import {routeEdges} from '../../../core/src/layout/driver'

function measureTextSize(str: string): Size {
  return new Size(str.length * 8 + 8, 20)
}

function sumEdgeLengths(gg: GeomGraph): number {
  let total = 0
  for (const e of gg.deepEdges) {
    if (e.curve) total += e.curve.length
  }
  return total
}

function edgesToRoute(gg: GeomGraph): GeomEdge[] {
  return Array.from(gg.deepEdges)
}

test('GOT: sleeve vs spline edge length ratio', () => {
  const fpath = join(__dirname, '../data/JSONfiles/gameofthrones.json')
  const graphStr = fs.readFileSync(fpath, 'utf-8')
  const graph = parseJSON(JSON.parse(graphStr))
  const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  dg.createGeometry()
  const gg = <GeomGraph>GeomGraph.getGeom(graph)
  const {MdsLayoutSettings} = require('../../../core/src')
  gg.layoutSettings = new MdsLayoutSettings()

  // Layout once (node placement)
  gg.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Sleeve
  layoutGeomGraph(gg, null)
  const sleeveLen = sumEdgeLengths(gg)

  // Re-route with Spline (same node positions)
  gg.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
  routeEdges(gg, edgesToRoute(gg), null)
  const splineLen = sumEdgeLengths(gg)

  const ratio = sleeveLen / splineLen
  console.log(`GOT Sleeve: ${sleeveLen.toFixed(1)}`)
  console.log(`GOT Spline:   ${splineLen.toFixed(1)}`)
  console.log(`GOT Ratio (sleeve/spline) = ${ratio.toFixed(4)}`)
})

test('root.gv IPsepCola: sleeve vs spline edge length ratio', () => {
  const fpath = join(__dirname, '../data/graphvis/root.gv')
  const graphStr = fs.readFileSync(fpath, 'utf-8')
  const graph = parseDot(graphStr)
  const dg = DrawingGraph.getDrawingGraph(graph)
  dg.createGeometry(measureTextSize)
  const gg = <GeomGraph>GeomGraph.getGeom(graph)
  const settings = new IPsepColaSetting()
  settings.AvoidOverlaps = true
  settings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Sleeve
  gg.layoutSettings = settings

  // Layout once (node placement + sleeve routing)
  layoutGeomGraph(gg, null)
  const sleeveLen = sumEdgeLengths(gg)

  // Re-route with Spline (same node positions)
  settings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Spline
  routeEdges(gg, edgesToRoute(gg), null)
  const splineLen = sumEdgeLengths(gg)

  const ratio = sleeveLen / splineLen
  console.log(`root.gv Sleeve: ${sleeveLen.toFixed(1)}`)
  console.log(`root.gv Spline:   ${splineLen.toFixed(1)}`)
  console.log(`root.gv Ratio (sleeve/spline) = ${ratio.toFixed(4)}`)
})
