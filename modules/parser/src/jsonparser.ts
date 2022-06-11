import {Graph, Node} from 'msagl-js'
import {DrawingEdge, DrawingNode, ArrowTypeEnum, ShapeEnum} from 'msagl-js/drawing'

import {parseColor} from './utils'

export function parseSimpleJSON(json: {
  /** List of nodes in the graph */
  nodes: {
    /** Id of the node */
    id: number | string
    /** Weight of the node */
    weight?: number
    /** Label text of the node */
    label?: string
    /** Shape of the node. Default `box` */
    shape?: keyof typeof ShapeEnum
    /** [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color) of the node */
    color?: string
  }[]

  /** List of edges in the graph */
  edges: {
    /** Id of the source node */
    source: number | string
    /** Id of the target node */
    target: number | string
    /** Whether the edge is directed. Default `true` */
    directed?: boolean
    /** Weight of the edge */
    weight?: number
    /** Type of the arrow at the source. Default `none` */
    arrowhead?: keyof typeof ArrowTypeEnum
    /** Type of the arrow at the target. Default `none` */
    arrowtail?: keyof typeof ArrowTypeEnum
    /** [CSS color](https://developer.mozilla.org/en-US/docs/Web/CSS/color) of the edge */
    color?: string
  }[]
}): Graph {
  const g = new Graph()

  for (const node of json.nodes) {
    const id = String(node.id)
    const n = g.addNode(new Node(id))
    const dn = new DrawingNode(n)

    const {label = id, shape = 'box'} = node
    dn.labelText = label
    dn.ShapeEnum = ShapeEnum[shape]

    if ('weight' in node) {
      dn.weight = node.weight
    }
    if ('color' in node) {
      dn.color = parseColor(node.color)
    }
  }
  for (const edge of json.edges) {
    const e = g.setEdge(String(edge.source), String(edge.target))
    const de = new DrawingEdge(e)

    const {arrowhead = 'none', arrowtail = 'none', directed = true} = edge
    de.arrowhead = ArrowTypeEnum[arrowhead]
    de.arrowtail = ArrowTypeEnum[arrowtail]
    de.directed = directed

    if ('weight' in edge) {
      de.weight = edge.weight
    }
    if ('color' in edge) {
      de.color = parseColor(edge.color)
    }
  }

  return g
}
