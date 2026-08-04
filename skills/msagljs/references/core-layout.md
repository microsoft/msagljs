# Core layout without a viewer

Use `@msagl/core` when the application needs coordinates and routed curves but
does not need an MSAGL browser renderer.

## Required geometry attributes

```ts
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
  geomNode.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(
    100,
    40,
    6,
    6,
    new Point(0, 0),
  )
}

for (const edge of edges) new GeomEdge(edge)

const settings = new SugiyamaLayoutSettings()
settings.layerDirection = LayerDirectionEnum.LR
geomGraph.layoutSettings = settings

layoutGeomGraph(geomGraph)

for (const node of graph.nodesBreadthFirst) {
  const geomNode = GeomNode.getGeom(node)
  console.log(node.id, geomNode.center)
}

for (const edge of graph.deepEdges) {
  console.log(edge.source.id, edge.target.id, GeomEdge.getGeom(edge).curve)
}
```

The initial node positions do not determine the final layout, but every
`GeomNode` must have a non-degenerate boundary curve so layout and routing know
the node size.

## Settings

- `SugiyamaLayoutSettings` is appropriate for directed hierarchical graphs.
- `MdsLayoutSettings` is useful for topology-oriented placement where edge
  direction is not central.
- `FastIncrementalLayoutSettings` exposes the IPSepCola incremental/force-style
  layout.

Set the chosen settings on `GeomGraph.layoutSettings` before calling
`layoutGeomGraph()`.

When no settings are supplied, the driver selects a layered layout for a
directed graph of moderate size and IPSepCola otherwise. In core geometry, an
edge is considered directed when it has a source or target arrowhead. If the
algorithm choice matters, set it explicitly rather than relying on inference.

## Reading the result

- `GeomNode.getGeom(node).center` gives the final node center.
- `GeomNode.getGeom(node).boundingBox` gives the laid-out node bounds.
- `GeomEdge.getGeom(edge).curve` gives the routed edge curve.
- `geomGraph.boundingBox` gives the overall layout bounds.

Do not serialize internal class fields ad hoc. Convert the required points,
rectangles, and curves into an application-owned JSON shape.
