import {SugiyamaLayoutSettings, LayeredLayout, CancelToken, Size, GeomNode, GeomEdge, Graph, Node} from '../../../src'
import {DrawingGraph} from '../../../src/drawing/drawingGraph'
import {nodeBoundaryFunc, parseDotGraph} from '../../utils/testUtils'
import {createGeometry} from '../mds/SingleSourceDistances.spec'
test('subgraphs', () => {
  const graph = new Graph()
  const graphA = new Graph('a')
  graphA.addNode(new Node('node_of_a'))
  graph.addNode(graphA)
  const graphB = new Graph('b')
  graph.addNode(graphB)
  const graphAA = new Graph('aa')
  graphA.addNode(graphAA)
  const aaIds = Array.from(graph.allSuccessorsDepthFirst()).map((a) => a.id)

  const node_of_aIndex = aaIds.findIndex((a) => a == 'node_of_a')
  const aaIndex = aaIds.findIndex((a) => a == 'aa')

  const bIndex = aaIds.findIndex((a) => a == 'b')
  expect(bIndex > aaIndex).toBe(true)
  expect(node_of_aIndex < aaIndex)
})

test('geom subgraphs', () => {
  const graph = new Graph()
  const graphA = new Graph('a')
  graphA.addNode(new Node('node_of_a'))
  graph.addNode(graphA)
  const graphB = new Graph('b')
  graph.addNode(graphB)
  const graphAA = new Graph('aa')
  graphA.addNode(graphAA)
  const gg = createGeometry(graph, nodeBoundaryFunc, () => null)
  const aaIds = Array.from(gg.subgraphsDepthFirst).map((n) => (n as unknown as GeomNode).id)
  const node_of_aIndex = aaIds.findIndex((a) => a == 'node_of_a')
  expect(node_of_aIndex).toBe(-1)
  const aaIndex = aaIds.findIndex((a) => a == 'aa')

  const bIndex = aaIds.findIndex((a) => a == 'b')
  expect(bIndex > aaIndex).toBe(true)
})

test('intersectedEnities', () => {
  const g = parseDotGraph('graphvis/abstract.gv')
  const dg = DrawingGraph.getDrawingObj(g) as DrawingGraph
  const geomGraph = dg.createGeometry(() => new Size(20, 20))
  const ss = new SugiyamaLayoutSettings()
  const ll = new LayeredLayout(geomGraph, ss, new CancelToken())
  ll.run()
  const rect = geomGraph.boundingBox
  const rtree = geomGraph.buildRTree()
  const intersectedNodes = Array.from(geomGraph.intersectedObjects(rtree, rect))
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

  const intersectedNodesAndEdges = Array.from(geomGraph.intersectedObjects(rtree, rect, false)).filter((e) => e instanceof GeomEdge)

  expect(intersectedNodesAndEdges.length).toBe(Array.from(geomGraph.deepEdges).length)
  for (const e of geomGraph.edges()) {
    const r = e.boundingBox
    const intersected_e = Array.from(geomGraph.intersectedObjects(rtree, r, false))
    expect(intersected_e.indexOf(e)).toBeGreaterThan(-1)
    expect(intersected_e.indexOf(e.source)).toBeGreaterThan(-1)
    expect(intersected_e.indexOf(e.target)).toBeGreaterThan(-1)
  }
})
