import {SugiyamaLayoutSettings, LayeredLayout, CancelToken, Size, GeomNode, GeomEdge} from '../../../src'
import {DrawingGraph} from '../../../src/drawing/drawingGraph'
import {parseDotGraph} from '../../utils/testUtils'

test('intersectedEnities', () => {
  const g = parseDotGraph('graphvis/abstract.gv')
  const dg = DrawingGraph.getDrawingObj(g) as DrawingGraph
  const geomGraph = dg.createGeometry(() => new Size(20, 20))
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(geomGraph, ss, new CancelToken())
  ll.run()
  const rect = geomGraph.boundingBox
  const intersectedNodes = Array.from(geomGraph.intersectedObjects(rect))
  let n = 0 // the number of nodes that intersected the bounding box
  let e = 0 // the number of edges that intersected the bounding box
  for (const o of intersectedNodes) {
    if (o instanceof GeomNode) {
      n++
    } else if (o instanceof GeomEdge) {
      e++
    }
  }

  expect(n).toBe(Array.from(geomGraph.deepNodesIt()).length)
  expect(e).toBe(0)

  const intersectedNodesAndEdges = Array.from(geomGraph.intersectedObjects(rect, false)).filter((e) => e instanceof GeomEdge)

  expect(intersectedNodesAndEdges.length).toBe(Array.from(geomGraph.deepEdges).length)
  for (const e of geomGraph.edges()) {
    const r = e.boundingBox
    const intersected_e = Array.from(geomGraph.intersectedObjects(r, false))
    expect(intersected_e.indexOf(e)).toBeGreaterThan(-1)
    expect(intersected_e.indexOf(e.source)).toBeGreaterThan(-1)
    expect(intersected_e.indexOf(e.target)).toBeGreaterThan(-1)
  }
})
