import {Graph, Edge, Node} from 'msagl-js'
import {DrawingEdge, DrawingGraph, DrawingNode, parseDotString, ArrowTypeEnum, Color, ShapeEnum} from 'msagl-js/drawing'

export async function loadDefaultGraph(): Promise<DrawingGraph> {
  const resp = await fetch(
    'https://gist.githubusercontent.com/mohdsanadzakirizvi/6fc325042ce110e1afc1a7124d087130/raw/ab9a310cfc2003f26131a7149950947645391e28/got_social_graph.json',
  )
  const data = await resp.json()
  const g = new Graph('got_social_graph.json')

  const nodeMap: any = {}
  for (const node of data.nodes) {
    nodeMap[node.id] = node
    const n = g.addNode(new Node(node.character))
    const dn = new DrawingNode(n)
    dn.labelText = node.character
    dn.ShapeEnum = ShapeEnum.box
    dn.color = dn.labelText == 'Arya' ? Color.Red : Color.Black
  }
  for (const edge of data.links) {
    const e = g.setEdge(nodeMap[edge.source].character, nodeMap[edge.target].character)
    const de = new DrawingEdge(e)
    if (connectedToArya(e)) de.color = Color.Blue
    de.arrowtail = ArrowTypeEnum.none
    de.arrowhead = ArrowTypeEnum.none
    de.directed = false
  }

  return new DrawingGraph(g)
}

export async function loadDotFile(file: File): Promise<DrawingGraph> {
  const content = await file.text()
  const dg = parseDotString(content)
  dg.graph.id = file.name
  return dg
}

function connectedToArya(e: Edge) {
  return e.source.id == 'Arya' || e.target.id == 'Arya'
}
