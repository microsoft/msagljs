import {Graph, Edge, Node} from 'msagl-js'
import {DrawingEdge, DrawingNode, ArrowTypeEnum, Color, ShapeEnum} from 'msagl-js/drawing'

import {parseDot} from '@msagl/parser'

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

export async function loadDotFile(file: File | string): Promise<Graph> {
  let content: string
  if (typeof file === 'string') {
    const resp = await fetch(file)
    content = await resp.text()
  } else {
    content = await file.text()
  }
  const graph = parseDot(content)
  graph.id = typeof file === 'string' ? file.slice(file.lastIndexOf('/')) : file.name
  return graph
}
