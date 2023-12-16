import {RendererSvg} from '@msagl/renderer-svg'
import {Node, Graph, Edge} from '@msagl/core'

const viewer = document.getElementById('viewer')
const svgRenderer = new RendererSvg(viewer)
svgRenderer.layoutEditingEnabled = false

const graph = createGraph()
svgRenderer.setGraph(graph)

function createGraph(): Graph {
  //First we create a Graph object
  const graph = new Graph()
  // add some nodes and edges to the graph.
  // add a node with id 'b'
  const b = new Node('b')
  graph.addNode(b)
  // add a node with id 'c'
  const c = new Node('c')
  graph.addNode(c)
  // create edge from b to c
  const bc = new Edge(b, c)
  new Edge(b, c)
  return graph
}


