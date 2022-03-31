# msagl-js

## Sugiyama Scheme

Here is the layered layout example, or Sugiyama Scheme. By default, it creates a layout with
the nodes positioned on horizontal layers, where, if your directed graph does not have cycles, every
edge spans at least one layer down. Here is an API example in Typescript

```typescript
// Create a new geometry graph
const g = GeomGraph.mk('graph', new Size(0, 0))
// Add nodes to the graph. The first argument is the node id. The second is the size string
setNode(g, 'kspacey', 10, 10)
setNode(g, 'swilliams', 10, 10)
setNode(g, 'bpitt', 10, 10)
setNode(g, 'hford', 10, 10)
setNode(g, 'lwilson', 10, 10)
setNode(g, 'kbacon', 10, 10)

// Add edges to the graph.
g.setEdge('kspacey', 'swilliams')
g.setEdge('swilliams', 'kbacon')
g.setEdge('bpitt', 'kbacon')
g.setEdge('hford', 'lwilson')
g.setEdge('lwilson', 'kbacon')
layoutGraphWithSugiayma(g)
/// ... consume graph 'g' here
```

The generated layout should look like this:
![Alt text](./docs/images/showAPI.svg#gh-light-mode-only)
![Alt text](./docs/images/showAPI_dark.svg#gh-dark-mode-only)

That is the function that prepares a GeometryNode for layout.

```typescript
function setNode(g: GeomGraph, id: string, xRad: number, yRad: number): GeomNode {
  let node = g.graph.findNode(id)
  if (node == null) {
    g.graph.addNode((node = new Node(id)))
  }
  const geomNode = new GeomNode(node)
  const size = measureTextSize(id)
  geomNode.boundaryCurve = CurveFactory.mkRectangleWithRoundedCorners(size.width, size.height, xRad, yRad, new Point(0, 0))
  return geomNode
}
```

## Multi Dimensional Scaling

Multi Dimensional Scaling works: the routing is with just straight or rectilinear edges for now. The routing with smooth edges avoiding the nodes is not implemented yet. If you replace in the example above the line

```typescript
layoutGraphWithSugiayma(g)
```

by the line

```typescript
layoutGraphWithMDS(g)
```

then the layout should look like this
![Alt text](./docs/images/mdsShowAPI.svg#gh-light-mode-only)
![Alt text](./docs/images/mdsShowAPI_dark.svg#gh-dark-mode-only)

![Test Status](https://github.com/msaglJS/msagl-js/workflows/Test%20Status/badge.svg?branch=master)

## Examples

Currently there are only two examples at the "examples" dir. One of them, examples/layout, can be seen at https://msagljs.github.io/msagl-js/.
There, initially, the graph of relations between the characters of a known series is loaded. In addition, the page supports a visualization of DOT graphs.
You can view a DOT graph by drag-dropping it into the folder at the bottom of the page. If all edges in the DOT file are undirected then Pivot MDS is applied for the layout calculation: Otherwise, it is the Sugiyama Scheme.

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft 
trademarks or logos is subject to and must follow 
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
