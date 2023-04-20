---
sidebar_position: 4
---

# API

## Use the layout engine directly

When you interact with a renderer, many details are hidden under the hood.
Here, to show how to call the engine directly, we need to say a few words on the classes involved.

Let us describe the design of Node, Graph, and Edge.

Edge is the simplest: it has the source and the target that are Nodes.
Node has three sets of Edges: outEdges, inEdges, and selfEdges.
If you have an object of Node available you can iterate over all edges adjacent to it.
For example, to process all edges having node 'n' as the source do the following:

```ts
for (const e of n.outEdges()) {
  // process edge 'e'
}
```

Graph extends Node, but in addition it has a NodeCollection, which is just a wrapper
around Map<string, Node>: this way a Graph can reference its nodes. To create a sub-graph we just
add a Graph as a new node to the graph.

```ts
const graph = new Graph()
const subgraph = new Graph('a')
graph.addNode(subgraph)
```

This design seems minimal and efficient enough to maintain the graph structure. For example, to iterate over edges of the graph
we go over the nodes in the graph's NodeCollection and iterate over outgoing and self-edge of the nodes.

The classes Graph, Node, and Edge extends class Entity. Entity has a field parent that is also an Entity.
This way a Node, and an Edge, have a reference to the Graph they belongs to.
There is a class Label to facilitate labelled edges. The parent of a Label is the labeled edge.

Entity has an array of Attributes. The Attributes are handy to keep additional information about different things.
There are geometry attributes, drawing attributes, and some others.
The geometry attributes are needed to create a layout. The drawing attributes are used during rendering.
The attributes are a convenient mechanism to avoid the duplication of the graph structure.

Now we can return to the engine level layout example.

```ts
//First we create a Graph, the underlying structure to keep your graph.
const graph = new Graph()
// add some nodes and edges to the graph.
// add a node with id 'b'
const b = new Node('b')
graph.addNode(b)
// add a node with id 'c'
const c = new Node('c')
graph.addNode(c)
// create edges b->c, and d->a
const bc = new Edge(b, c)
new Edge(b, c)
```

The last statement of the code above

```ts
new Edge(b, c)
```

creates an instance of class Edge and adds it to b.outEdges and c.inEdges.
This way the edge the edge is attached to the graph.
For the engine to run the layout, the nodes geometry is needed. For this examples we create circular nodes.

```ts
// create a geometry node gb
const gb = new GeomNode(b)
gb.boundaryCurve = CurveFactory.mkCircle(20, new Point(0, 0))
```

The two lines above create a GeomNode, gb, corresponding to node 'b',
which is actually an Attribute that is stored in the array of attributes of node 'b'.
The code also sets the boundary curve describing the shape of 'gb': in this case it is
a circle with the radius of length 20 and the center at the origin of the plane. The layout might transform the
curve later by changing the circle center. We also need to create geometry attributes for each element of the graph
to interact with the layout, and, finally, call the layout engine. Below the whole working example.

```ts build
import {
  CurveFactory,
  Edge,
  GeomEdge,
  GeomGraph,
  GeomNode,
  Graph,
  Node,
  Point,
  layoutGeomGraph,
} from '@msagl/core'
const graph = new Graph()
// add some nodes and edges to the graph.
// add a node with id 'b'
const b = new Node('b')
graph.addNode(b)
// add a node with id 'c'
const c = new Node('c')
graph.addNode(c)
// create edges b->c, and d->a
const bc = new Edge(b, c)
const geomGraph = new GeomGraph(graph)
const gbc: GeomEdge = new GeomEdge(bc)
const gb = new GeomNode(b)
gb.boundaryCurve = CurveFactory.mkCircle(20, new Point(0, 0))
const gc = new GeomNode(c)
gc.boundaryCurve = CurveFactory.mkCircle(20, new Point(0, 0))
layoutGeomGraph(geomGraph)

console.log(gbc.curve)
```

This code produces the output 'LineSegment {
parStart: 0,
parEnd: 1,
start: Point { x*: 49.99999999999999, y*: 30 },
end: Point { x*: 70, y*: 30 }
}'

## Renderer with Deck.gl

Constructor:

```ts
new Renderer(container?: HTMLDivElement)
```

To layout and render a new graph:

```ts
renderer.setGraph(g: Graph, options: RenderOptions)
```

To change the layout of the current graph:

```ts
renderer.setOptions(options: LayoutOptions)
```

## Usage of SVG Renderer

```ts build
import { parseDot } from '@msagl/parser'
import { RendererSvg } from '@msagl/renderer-svg'
const renderer = new RendererSvg()
const graph = parseDot(`
graph G {
	kspacey -- swilliams;
	swilliams -- kbacon;
	bpitt -- kbacon;
	hford -- lwilson;
	lwilson -- kbacon;
}`)
renderer.setGraph(graph)
```

## Renderer with SVG API

Constructor:

```ts
rendererSvg=new RendererSVG(container?: HTMLDivElement)
```

To layout and render a new graph:

```ts
rendererSvg.setGraph(g: Graph, options: RenderOptions)
```

To change the layout of the current graph:

```ts
rendererSvg.setOptions(options: LayoutOptions)
```

To get the SVG representation of the graph:

```ts
getSvg(): SVGAElement
```
