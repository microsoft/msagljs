import {Graph, Node} from '@msagl/core'
import {DrawingEdge, DrawingNode, ArrowTypeEnum, ShapeEnum, DrawingGraph} from '@msagl/core/drawing'
import {Graph as JSONGraph} from 'dotparser'

import {parseJSONGraph} from './dotparser'
import {parseColor} from './utils'

type SimpleJSONGraph = {
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
}

export function parseJSON(json: JSONGraph | SimpleJSONGraph): Graph {
  if ('nodes' in json) {
    return parseSimpleJSON(json)
  }
  return parseJSONGraph(json)
}

export function parseSimpleJSON(json: SimpleJSONGraph): Graph {
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
    const de = new DrawingEdge(e, false)

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

  new DrawingGraph(g) // create the DrawingAttribute on the graph
  return g
}
