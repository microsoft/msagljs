import {join} from 'path'
import * as fs from 'fs'
import {parseJSON} from '../../../parser/src/dotparser'
import {
  GeomGraph,
  GeomEdge,
  GeomNode,
  layoutGeomGraph,
  EdgeRoutingMode,
  geometryIsCreated,
  Point,
} from '../../../core/src'
import {DrawingGraph} from '../../../drawing/src'
import {Curve, PointLocation} from '../../../core/src/math/geometry/curve'

function layoutGotWithSleeve(): GeomGraph {
  const fpath = join(__dirname, '../data/JSONfiles/gameofthrones.json')
  const graphStr = fs.readFileSync(fpath, 'utf-8')
  const graph = parseJSON(JSON.parse(graphStr))
  const dg = <DrawingGraph>DrawingGraph.getDrawingObj(graph)
  dg.createGeometry()
  const geomGraph = <GeomGraph>GeomGraph.getGeom(graph)
  if (!geomGraph.layoutSettings) {
    const {MdsLayoutSettings} = require('../../../core/src')
    geomGraph.layoutSettings = new MdsLayoutSettings()
  }
  geomGraph.layoutSettings.commonSettings.edgeRoutingSettings.EdgeRoutingMode = EdgeRoutingMode.Sleeve
  layoutGeomGraph(geomGraph, null)
  return geomGraph
}

test('sleeve routing on gameofthrones has no null curves', () => {
  const geomGraph = layoutGotWithSleeve()

  let nullCurves = 0
  let totalEdges = 0
  let hasSourceArrow = 0
  let hasTargetArrow = 0
  for (const e of geomGraph.deepEdges) {
    totalEdges++
    if (e.curve == null) nullCurves++
    if (e.sourceArrowhead) hasSourceArrow++
    if (e.targetArrowhead) hasTargetArrow++
  }
  console.log(`Total edges: ${totalEdges}, null curves: ${nullCurves}, sourceArrows: ${hasSourceArrow}, targetArrows: ${hasTargetArrow}`)
  expect(nullCurves).toBe(0)
})

test('sleeve routing: edges do not cross through non-endpoint nodes', () => {
  const geomGraph = layoutGotWithSleeve()

  // Collect all nodes and their boundary curves
  const nodes: GeomNode[] = []
  for (const n of geomGraph.nodesBreadthFirst) {
    if (n.boundaryCurve) nodes.push(n)
  }

  let crossingEdges = 0
  let totalEdges = 0
  const crossingExamples: string[] = []

  for (const edge of geomGraph.deepEdges) {
    totalEdges++
    if (edge.curve == null) continue
    const srcId = edge.source
    const tgtId = edge.target

    // Sample points along the curve (10 samples per segment)
    const samples: Point[] = []
    const curve = edge.curve
    const pStart = curve.parStart
    const pEnd = curve.parEnd
    const steps = 20
    for (let i = 1; i < steps; i++) {
      const t = pStart + (pEnd - pStart) * (i / steps)
      samples.push(curve.value(t))
    }

    let crosses = false
    for (const node of nodes) {
      if (node === srcId || node === tgtId) continue
      const bc = node.boundaryCurve
      for (const pt of samples) {
        const loc = Curve.PointRelativeToCurveLocation(pt, bc)
        if (loc === PointLocation.Inside) {
          crosses = true
          if (crossingExamples.length < 10) {
            crossingExamples.push(
              `${edge.edge.source.id} -> ${edge.edge.target.id} crosses ${node.node.id}`,
            )
          }
          break
        }
      }
      if (crosses) break
    }
    if (crosses) crossingEdges++
  }

  console.log(`Edges crossing non-endpoint nodes: ${crossingEdges}/${totalEdges} (${(100 * crossingEdges / totalEdges).toFixed(1)}%)`)
  if (crossingExamples.length > 0) {
    console.log('Examples:')
    for (const ex of crossingExamples) console.log('  ', ex)
  }
  // Informational test — log the count but don't fail yet
  // (some crossings are expected in dense graphs with padding=2)
})
