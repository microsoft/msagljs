import {join} from 'path'
import * as fs from 'fs'
import {parseJSON} from '../../../parser/src/dotparser'
import {
  GeomGraph,
  GeomEdge,
  layoutGeomGraph,
  EdgeRoutingMode,
  geometryIsCreated,
} from '../../../core/src'
import {DrawingGraph} from '../../../drawing/src'

test('corridor routing on gameofthrones has no null curves', () => {
  const fpath = join(__dirname, '../data/JSONfiles/gameofthrones.json')
  const graphStr = fs.readFileSync(fpath, 'utf-8')
  const graph = parseJSON(JSON.parse(graphStr))
  expect(graph).not.toBeNull()
  const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  dg.createGeometry()
  const geomGraph = <GeomGraph>GeomGraph.getGeom(graph)
  if (!geomGraph.layoutSettings) {
    const {MdsLayoutSettings} = require('../../../core/src')
    geomGraph.layoutSettings = new MdsLayoutSettings()
  }
  geomGraph.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Corridor
  layoutGeomGraph(geomGraph, null)

  let nullCurves = 0
  let totalEdges = 0
  const nullEdges: string[] = []
  for (const e of geomGraph.deepEdges) {
    totalEdges++
    if (e.curve == null) {
      nullCurves++
      nullEdges.push(`${e.edge.source.id} -> ${e.edge.target.id} sourcePort=${e.sourcePort != null} targetPort=${e.targetPort != null}`)
    }
  }
  console.log(`Total edges: ${totalEdges}, null curves: ${nullCurves}`)
  if (nullEdges.length > 0) {
    console.log('Null curve edges (first 10):')
    for (const ne of nullEdges.slice(0, 10)) {
      console.log('  ', ne)
    }
  }
  expect(nullCurves).toBe(0)
})
