import {Graph, Edge, Node} from 'msagl-js'
import {DrawingEdge, DrawingGraph, DrawingNode, parseDotString, ArrowTypeEnum, Color, ShapeEnum} from 'msagl-js/drawing'

export async function loadDefaultGraph(): Promise<Graph> {
  const resp = await fetch('https://raw.githubusercontent.com/microsoft/msagljs/main/examples/data/gameofthrones.json')
  const data = await resp.json()
  const g = new Graph('gameofthrones.json')

  const nodeMap: any = {}
  for (const node of data.nodes) {
    nodeMap[node.id] = node
    const n = g.addNode(new Node(node.name))
    const dn = new DrawingNode(n)
    dn.labelText = node.name
    dn.ShapeEnum = ShapeEnum.box
  }
  for (const edge of data.edges) {
    const e = g.setEdge(nodeMap[edge.source].name, nodeMap[edge.target].name)
    const de = new DrawingEdge(e)
    de.arrowtail = ArrowTypeEnum.none
    de.arrowhead = ArrowTypeEnum.none
    de.directed = false
  }

  return g
}

export async function loadDotFile(file: File): Promise<Graph> {
  const content = await file.text()
  const dg = parseDotString(content)
  dg.graph.id = file.name
  return dg.graph
}
