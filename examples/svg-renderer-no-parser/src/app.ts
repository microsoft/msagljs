import {RendererSvg} from '@msagl/renderer-svg'
import {Node, Graph, Edge} from '@msagl/core'
import { DrawingEdge, Color, StyleEnum, ShapeEnum } from '@msagl/drawing'
import { DrawingNode } from '@msagl/drawing'

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

  //create a drawing attribute for node b
  const b_d = new DrawingNode(b)
  b_d.color = Color.Green
  // take care of the filling
  b_d.fillColor = Color.Yellow
  b_d.styles.push(StyleEnum.filled)
  b_d.labelfontcolor = Color.Blue

  
  const c = new Node('c')
  const c_d = new DrawingNode(c)
  c_d.labelfontcolor = Color.Cyan

  // By default, the node geometry is a rectangle with smoothened corners with dimensions obtained from the label size, 
  // but we can change the geometry by using CurveFactory.mkCircle, CurveFactory.mkEllipse, CurveFactory.mkPolygon,etc.
  // Or, alternatively, we can use ShapeEnum: Here we use it to change the shape of the node to diamond.
  c_d.shape = ShapeEnum.diamond

  graph.addNode(c)
  // create edge from b to c
  const bc = new Edge(b, c)

  // set the bc drawing edge attributes
  const bc_d = new DrawingEdge(bc, true)
  bc_d.color = Color.Red
  
  bc_d.penwidth = 0.1
  bc_d.styles.push(StyleEnum.dashed)

  const obc = new Edge(b, c) // another edge from b to c  
  // set the obc drawing edge attributes
  const obc_d = new DrawingEdge(obc, true)
  obc_d.color = Color.Blue
  obc_d.penwidth = 1
  obc_d.styles.push(StyleEnum.dotted) 
  return graph
}


