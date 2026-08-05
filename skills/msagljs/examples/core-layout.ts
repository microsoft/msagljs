import {
  CurveFactory,
  Edge,
  GeomEdge,
  GeomGraph,
  GeomNode,
  Graph,
  LayerDirectionEnum,
  Node,
  Point,
  SugiyamaLayoutSettings,
  layoutGeomGraph,
} from '@msagl/core'

const graph = new Graph('pipeline')
const ingest = graph.addNode(new Node('ingest'))
const transform = graph.addNode(new Node('transform'))
const publish = graph.addNode(new Node('publish'))

const edges = [new Edge(ingest, transform), new Edge(transform, publish)]
const geomGraph = new GeomGraph(graph)

for (const node of graph.nodesBreadthFirst) {
  const geomNode = new GeomNode(node)
  geomNode.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(100, 40, 6, 6, new Point(0, 0))
}

for (const edge of edges) new GeomEdge(edge)

const settings = new SugiyamaLayoutSettings()
settings.layerDirection = LayerDirectionEnum.LR
geomGraph.layoutSettings = settings
layoutGeomGraph(geomGraph)

for (const node of graph.nodesBreadthFirst) {
  console.log(node.id, GeomNode.getGeom(node).center)
}

for (const edge of graph.deepEdges) {
  console.log(`${edge.source.id} -> ${edge.target.id}`, GeomEdge.getGeom(edge).curve)
}
