import parse, {AttrStmt, EdgeStmt, NodeId, NodeStmt, Stmt, Subgraph} from 'dotparser'
import {
  Edge,
  Graph,
  LayerDirectionEnum,
  Node,
  Label,
  setNewParent,
  GeomObject,
  GeomNode,
  Entity,
  GeomEdge,
  Point,
  GeomGraph,
  ICurveJSONTyped,
  iCurveToJSON,
  JSONToICurve,
} from 'msagl-js'
import {Graph as JSONGraph, Attr} from 'dotparser'
import {
  ArrowTypeEnum,
  DrawingEdge,
  DrawingGraph,
  DrawingLabel,
  DrawingNode,
  DrawingObject,
  RankEnum,
  ShapeEnum,
  StyleEnum,
  OrderingEnum,
  DirTypeEnum,
} from 'msagl-js/drawing'

import {parseColor} from './utils'
// import {Assert} from '../../core/src/utils/assert'

function parseAttrs(o: any, entity: Entity) {
  const drawingObj = DrawingObject.getDrawingObj(entity)
  if (o.attr_list == null) return
  for (const attr of o.attr_list) {
    if (attr.type == 'attr') {
      const str = attr.eq
      switch (attr.id) {
        // geometry attributes
        case 'edgeCurve':
          {
            const geom = getOrCreateGeomObj(entity) as GeomEdge
            const json = JSON.parse(str) as ICurveJSONTyped
            geom.curve = JSONToICurve(json)
          }

          break
        case 'boundaryCurve':
          {
            const geom = getOrCreateGeomObj(entity) as GeomNode
            const json = JSON.parse(str) as ICurveJSONTyped
            const curve = JSONToICurve(json)
            if (geom instanceof GeomGraph) {
              geom.boundingBox = curve.boundingBox
            } else {
              geom.boundaryCurve = curve
            }
          }

          break

        case 'sourceArrowhead': {
          const geomEdge = getOrCreateGeomObj(entity) as GeomEdge
          geomEdge.sourceArrowhead.tipPosition = Point.fromJSON(JSON.parse(str))
          break
        }
        case 'targetArrowhead': {
          const geomEdge = getOrCreateGeomObj(entity) as GeomEdge
          geomEdge.targetArrowhead.tipPosition = Point.fromJSON(JSON.parse(str))
          break
        }
        // end of geometry attributes
        case 'color':
          drawingObj.color = parseColor(str)

          break
        case 'pencolor':
          drawingObj.pencolor = parseColor(str)
          break
        case 'labelfontcolor':
          drawingObj.labelfontcolor = parseColor(str)
          break
        case 'fontcolor':
          drawingObj.fontColor = parseColor(str)
          break
        case 'fillcolor':
          drawingObj.fillColor = parseColor(str)
          break
        case 'style':
          for (const style of stylesEnumFromString(str)) {
            drawingObj.styles.push(style)
          }
          break
        case 'shape': {
          const dn = <DrawingNode>drawingObj
          dn.shape = shapeEnumFromString(str)
          break
        }
        case 'peripheries':
          drawingObj.peripheries = parseInt(str)
          break
        case 'headlabel':
          drawingObj.headlabel = str
          break
        case 'label':
          // ignore html labels, for example

          if (typeof str === 'string') {
            // ignore html labels, for example
            const find = '\\n'
            let j = 0
            drawingObj.labelText = ''
            do {
              const i = str.indexOf(find, j)
              if (i >= 0) {
                drawingObj.labelText += str.substring(j, i) + '\n'
                j = i + 2
              } else {
                drawingObj.labelText += str.substring(j)
                break
              }
            } while (true)
          } else if (typeof str === 'number') {
            drawingObj.labelText = str.toString()
          }

          break
        case 'size':
          drawingObj.size = parseFloatTuple(str)
          break
        case 'pos':
          drawingObj.pos = parseFloatTuple(str)
          break
        case 'rankdir':
          drawingObj.rankdir = rankDirEnumFromString(str)
          break
        case 'fontname':
          drawingObj.fontname = str
          break
        case 'fontsize':
          drawingObj.fontsize = parseFloat(str)
          break
        case 'width':
          drawingObj.width = parseFloat(str)
          break
        case 'penwidth':
          drawingObj.penwidth = parseFloat(str)
          break

        case 'height':
          drawingObj.height = parseFloat(str)
          break
        case 'margin':
          drawingObj.margin = parseFloat(str)
          break
        case 'len':
          drawingObj.len = parseFloat(str)
          break
        case 'minlen':
          drawingObj.minlen = parseFloat(str)
          break
        case 'rank':
          drawingObj.rank = rankEnumFromString(str)
          break
        case 'charset':
          drawingObj.charset = str
          break
        case 'orientation':
          drawingObj.orientation = str
          break
        case 'ratio':
          drawingObj.ratio = str
          break
        case 'weight':
          drawingObj.weight = parseFloat(str)
          break
        case 'nodesep':
          drawingObj.nodesep = parseFloat(str)
          break
        case 'layersep':
          drawingObj.layersep = parseFloat(str)
          break
        case 'arrowsize':
          drawingObj.arrowsize = parseFloat(str)
          break
        case 'rotate':
          drawingObj.rotate = parseFloat(str)
          break
        case 'ranksep':
          drawingObj.ranksep = parseFloat(str)
          break
        case 'splines':
          drawingObj.splines = str == 'true'
          break
        case 'overlap':
          drawingObj.overlap = str == 'true'
          break
        case 'arrowtail':
          drawingObj.arrowtail = arrowTypeEnumFromString(str)
          break
        case 'taillabel':
          drawingObj.taillabel = str
          break
        case 'arrowhead':
          drawingObj.arrowhead = arrowTypeEnumFromString(str)
          break
        case 'ordering':
          drawingObj.ordering = orderingEnumFromString(str)
          break
        case 'URL':
          drawingObj.URL = str
          break
        case 'dir':
          drawingObj.dir = dirTypeEnumFromString(str)
          break
        case 'concentrate':
          drawingObj.concentrate = str == 'true'
          break
        case 'compound':
          drawingObj.compound = str == 'true'
          break
        case 'lhead':
          drawingObj.lhead = str
          break
        case 'ltail':
          drawingObj.ltail = str
          break
        case 'bgcolor':
          drawingObj.bgcolor = parseColor(str)
          break
        case 'center':
          drawingObj.center = str == true || parseInt(str) == 1
          break
        case 'colorscheme':
          drawingObj.colorscheme = str
          break
        case 'sides':
          drawingObj.sides = parseInt(str)
          break
        case 'distortion':
          drawingObj.distortion = parseFloat(str)
          break
        case 'skew':
          drawingObj.skew = parseFloat(str)
          break
        case 'bb':
          drawingObj.bb = parseFloatQuatriple(str)
          break
        case 'labelloc':
          drawingObj.labelloc = str
          break
        case 'decorate':
          drawingObj.decorate = str == 'true'
          break
        case 'tailclip':
          drawingObj.tailclip = str == 'true'
          break
        case 'headclip':
          drawingObj.headclip = str == 'true'
          break
        case 'constraint':
          drawingObj.constraint = str == 'true'
          break
        case 'gradientangle':
          drawingObj.gradientangle = parseFloat(str)
          break
        case 'samehead':
          drawingObj.samehead = str
          break
        case 'href':
          drawingObj.href = str
          break
        case 'imagepath':
          drawingObj.imagepath = str
          break
        case 'image':
          drawingObj.image = str
          break
        case 'labeljust':
          drawingObj.labejust = str
          break
        case 'layers':
          drawingObj.layers = str.split(',')
          break
        case 'layer':
          drawingObj.layer = str
          break
        case 'f':
          drawingObj.f = parseFloat(str)
          break
        case 'nojustify':
          drawingObj.nojustify = str == 'true'
          break
        case 'root':
          drawingObj.root = str == 'true'
          break
        case 'page':
          drawingObj.page = parseFloatTuple(str)
          break
        case 'pname':
          drawingObj.pname = str
          break
        case 'kind':
          drawingObj.kind = str
          break
        case 'fname':
          drawingObj.fname = str
          break
        case 'subkind':
          drawingObj.subkind = str
          break
        case 'area':
          drawingObj.area = parseFloat(str)
          break
        case 'tailport':
          drawingObj.tailport = str
          break
        case 'headport':
          drawingObj.headport = str
          break
        case 'wt':
          drawingObj.wt = str
          break
        case 'id':
          if (drawingObj instanceof DrawingNode) {
          } else {
            drawingObj.id = str
          }
          break
        case 'edgetooltip':
          drawingObj.edgetooltip = str
          break
        case 'headtooltip':
          drawingObj.headtooltip = str
          break
        case 'tailtooltip':
          drawingObj.tailtooltip = str
          break
        case 'headURL':
          drawingObj.headURL = str
          break
        case 'tailURL':
          drawingObj.tailURL = str
          break
        case 'labelURL':
          drawingObj.labelURL = str
          break
        case 'edgeurl':
          drawingObj.edgeurl = str
          break
        case 'shapefile':
          drawingObj.shapefile = str
          break
        case 'xlabel':
          drawingObj.xlabel = str
          break
        case 'sametail':
          drawingObj.sametail = str
          break
        case 'clusterrank':
          drawingObj.clusterRank = str
          break
        default:
          break // remove the comment below to catch unsupported attributes
        // throw new Error('not implemented for ' + attr.id)
      }
    } else {
      throw new Error('unexpected type ' + attr.type)
    }
  }
}

class DotParser {
  ast: JSONGraph[]
  graph: Graph
  drawingGraph: DrawingGraph
  arrayOfDefaultAttrs: any[] = []
  get defaultNodeAttr(): any {
    return this.arrayOfDefaultAttrs[this.arrayOfDefaultAttrs.length - 1]
  }
  nodeMap = new Map<string, Node>()
  constructor(ast: JSONGraph[]) {
    this.ast = ast
  }

  parseEdge(so: Subgraph | NodeId, to: Subgraph | NodeId, graph: Graph, directed: boolean, o: EdgeStmt): Edge[] {
    const nc = graph.nodeCollection
    let sn: Node
    let tn: Node
    if (so.type == 'node_id') {
      const s = so.id.toString()
      if (!nc.hasNode(s)) {
        sn = this.newNode(s, graph, false)
      } else {
        sn = nc.getNode(s)
      }
    } else {
      const drObjs = []
      for (const ch of so.children) {
        if (ch.type === 'node_stmt') {
          for (const e of this.parseEdge(ch.node_id, to, graph, directed, o)) drObjs.push(e)
        } else if (ch.type === 'attr_stmt') {
        } else {
          throw new Error('not implemented')
        }
      }
      for (const ch of so.children) {
        if (ch.type === 'attr_stmt') {
          for (const drObj of drObjs) parseAttrs(ch, drObj)
        } // ignore anything else
      }
      return drObjs
    }
    if (to.type == 'node_id') {
      const t = to.id.toString()
      if (!nc.hasNode(t)) {
        tn = this.newNode(t, graph, false)
      } else {
        tn = nc.getNode(t)
      }
    } else if (to.type == 'subgraph') {
      const subgraphEdges = new Array<Edge>()
      for (const ch of to.children) {
        if (ch.type === 'node_stmt') {
          for (const e of this.parseEdge(so, ch.node_id, graph, directed, o)) subgraphEdges.push(e)
        } else if (ch.type === 'attr_stmt') {
        } else {
          throw new Error('not implemented')
        }
      }
      for (const ch of to.children) {
        if (ch.type === 'attr_stmt') {
          for (const drObj of subgraphEdges) parseAttrs(ch, drObj)
        } // ignore anything else
      }
      return subgraphEdges
    }
    const edge = new Edge(sn, tn)
    nc.addEdge(edge)
    const drawingEdge = new DrawingEdge(edge)
    parseAttrs(o, edge)
    if (drawingEdge.labelText) {
      edge.label = new Label(drawingEdge.labelText, edge)
      drawingEdge.label = new DrawingLabel(drawingEdge.labelText)
    }
    drawingEdge.directed = directed
    return [edge]
  }

  newNode(id: string, g: Graph, underSubgraph: boolean): Node {
    let n = this.nodeMap.get(id)
    if (n == null) {
      n = new Node(id)
      this.nodeMap.set(id, n)
      g.addNode(n)
      const dn = new DrawingNode(n)
      dn.labelText = id
      if (this.defaultNodeAttr) {
        parseAttrs(this.defaultNodeAttr, n)
      }
    } else if (underSubgraph) {
      // if the node is under a subgraph - change its parent to the subgraph
      setNewParent(g, n)
    }

    return n
  }
  parseNode(o: NodeStmt, graph: Graph, underSubgraph: boolean): Node {
    const id = o.node_id.id.toString()
    const node = this.newNode(id, graph, underSubgraph)

    if (DrawingObject.getDrawingObj(node) == null) {
      new DrawingNode(node)
    }
    parseAttrs(o, node)
    return node
  }
  parse(): Graph {
    if (this.ast == null) return null
    this.graph = new Graph(this.ast[0].id ? this.ast[0].id.toString() : '__graph__')
    this.drawingGraph = new DrawingGraph(this.graph)
    this.parseUnderGraph(this.ast[0].children, this.graph, this.ast[0].type == 'digraph', false)
    removeEmptySubgraphs(this.graph)
    createGeomForSubgraphs(this.graph)
    return this.graph
  }
  parseGraphAttr(o: AttrStmt, graph: Graph) {
    if (o.target == 'node') {
      this.arrayOfDefaultAttrs.push(o) // will parse it for each node
    } else if (o.target == 'graph') {
      parseAttrs(o, graph)
    }
  }

  getEntitiesSubg(o: Subgraph, graph: Graph, directed: boolean): Entity[] {
    let ret = []
    for (const ch of o.children) {
      if (ch.type == 'edge_stmt') {
        for (let i = 0; i < ch.edge_list.length - 1; i++) {
          for (const e of this.parseEdge(ch.edge_list[i], ch.edge_list[i + 1], graph, directed, ch)) ret.push(e)
        }
      } else if (ch.type == 'attr_stmt') {
      } else if (ch.type == 'node_stmt') {
        ret.push(this.parseNode(ch, graph, true))
      } else if (ch.type === 'subgraph') {
        if (ch.id != null) {
          const subg = new Graph(ch.id.toString())
          graph.addNode(subg)
          const sdg = new DrawingGraph(subg)
          this.parseUnderGraph(ch.children, subg, directed, true)
          ret.push(sdg)
        } else {
          ret = ret.concat(this.getEntitiesSubg(ch, graph, directed))
        }
      } else {
        throw new Error('Function not implemented.')
      }
    }
    return ret
  }

  parseUnderGraph(children: Array<Stmt>, graph: Graph, directed: boolean, underSubgraph: boolean) {
    for (const o of children) {
      switch (o.type) {
        case 'node_stmt':
          this.parseNode(o, graph, underSubgraph)
          break
        case 'edge_stmt':
          {
            const edgeList = o.edge_list
            for (let i = 0; i < edgeList.length - 1; i++) this.parseEdge(edgeList[i], edgeList[i + 1], graph, directed, o)
          }
          break
        case 'subgraph':
          {
            const lengthOfAttr = this.arrayOfDefaultAttrs.length
            // is it really a subgraph?
            if (this.process_same_rank(o, DrawingGraph.getDrawingGraph(graph))) {
            } else if (o.id == null) {
              const entities: Entity[] = this.getEntitiesSubg(o, graph, directed)
              applyAttributesToEntities(o, DrawingGraph.getDrawingGraph(graph), entities)
            } else {
              const subg = new Graph(o.id.toString())
              new DrawingGraph(subg)
              this.parseUnderGraph(o.children, subg, directed, true)
              if (!subg.isEmpty()) graph.addNode(subg)
            }
            while (this.arrayOfDefaultAttrs.length > lengthOfAttr) {
              this.arrayOfDefaultAttrs.pop()
            }
          }
          break
        case 'attr_stmt':
          this.parseGraphAttr(o, graph)
          break
        default:
          throw new Error('not implemented')
      }
    }
  }
  process_same_rank(o: Subgraph, dg: DrawingGraph): boolean {
    const attr = o.children[0]
    if (attr == undefined) return false
    if (attr.type != 'attr_stmt') return false
    const attr_list = attr.attr_list
    if (attr_list == undefined) return false
    if (attr_list.length == 0) return false
    const attr_0 = attr_list[0]
    if (attr_0.type != 'attr') return false
    if (attr_0.id != 'rank') return false
    switch (attr_0.eq) {
      case 'min':
        for (let i = 1; i < o.children.length; i++) {
          const c = o.children[i]
          if (c.type == 'node_stmt') {
            dg.graphVisData.minRanks.push(c.node_id.id.toString())
          } else {
            throw new Error()
          }
        }
        return true

      case 'max':
        for (let i = 1; i < o.children.length; i++) {
          const c = o.children[i]
          if (c.type == 'node_stmt') {
            dg.graphVisData.minRanks.push(c.node_id.id.toString())
          } else {
            throw new Error()
          }
        }
        return true

      case 'same': {
        const sameRank = []
        for (let i = 1; i < o.children.length; i++) {
          const c = o.children[i]
          if (c.type == 'node_stmt') {
            this.newNode(c.node_id.id.toString(), dg.graph, false)
            sameRank.push(c.node_id.id.toString())
          } else if (c.type == 'attr_stmt') {
            if (c.target == 'node') {
              this.arrayOfDefaultAttrs.push(c)
            }
          }
        }
        dg.graphVisData.sameRanks.push(sameRank)

        return true
      }
      case 'source': {
        for (let i = 1; i < o.children.length; i++) {
          const c = o.children[i]
          if (c.type == 'node_stmt') {
            dg.graphVisData.sourceRanks.push(c.node_id.id.toString())
          } else {
            throw new Error()
          }
        }
        return true
      }
      case 'sink':
        {
          for (let i = 1; i < o.children.length; i++) {
            const c = o.children[i]
            if (c.type == 'node_stmt') {
              dg.graphVisData.sinkRanks.push(c.node_id.id.toString())
            } else {
              throw new Error()
            }
          }
        }
        return true
      default:
        throw new Error('incorrect rank')
        return false
    }
  }
}

/** parses a string representing a Graph in DOT format */
export function parseDot(graphStr: string): Graph {
  const dp = new DotParser(parse(graphStr))
  return dp.parse()
}
/** parses a string representing a Graph in JSON format, corresponding to JSONGraph type */
export function parseJSON(graphStr: string): Graph {
  try {
    const ast: JSONGraph = JSON.parse(graphStr)
    const dp = new DotParser([ast])
    return dp.parse()
  } catch (Error) {
    console.log(Error.message)
    return null
  }
}
/** parses JSONGraph type to a Graph */
export function parseJSONGraph(jsonObj: JSONGraph): Graph {
  const dp = new DotParser([jsonObj])
  return dp.parse()
}

function* stylesEnumFromString(str: string): IterableIterator<StyleEnum> {
  const styles = str.split(',')
  for (const t of styles) {
    const typedStyleString = t as keyof typeof StyleEnum
    const ret = StyleEnum[typedStyleString]
    if (ret) {
      yield ret
    }
  }
}
function shapeEnumFromString(t: string): ShapeEnum {
  const typedStyleString = t.toLowerCase() as keyof typeof ShapeEnum
  return ShapeEnum[typedStyleString]
}
function parseFloatTuple(str: string): [number, number] {
  const p = str.split(',')
  return [parseFloat(p[0]), parseFloat(p[1])]
}

function rankDirEnumFromString(t: string): LayerDirectionEnum {
  const typedStyleString = t as keyof typeof LayerDirectionEnum
  return LayerDirectionEnum[typedStyleString]
}
function rankEnumFromString(t: string): RankEnum {
  const typedStyleString = t as keyof typeof RankEnum
  return RankEnum[typedStyleString]
}
function arrowTypeEnumFromString(t: string): ArrowTypeEnum {
  const typedStyleString = t as keyof typeof ArrowTypeEnum
  return ArrowTypeEnum[typedStyleString]
}

function orderingEnumFromString(t: string): OrderingEnum {
  const typedStyleString = t as keyof typeof OrderingEnum
  return OrderingEnum[typedStyleString]
}
function dirTypeEnumFromString(t: string): DirTypeEnum {
  const typedStyleString = t as keyof typeof DirTypeEnum
  return DirTypeEnum[typedStyleString]
}
function parseFloatQuatriple(str: any): any {
  const p = str.split(',')
  return [parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3])]
}

function applyAttributesToEntities(o: any, dg: DrawingGraph, entities: Entity[]) {
  for (const ch of o.children) {
    if (ch.type == 'attr_stmt') {
      for (const ent of entities) parseAttrs(ch, ent)
    }
  }
}
function removeEmptySubgraphs(graph: Graph) {
  const emptySubgraphList: Graph[] = []
  for (const sg of graph.subgraphs()) {
    if (sg.isEmpty()) {
      emptySubgraphList.push(sg)
    }
  }
  for (const sg of emptySubgraphList) {
    const parent = sg.parent as Graph
    if (parent) {
      parent.removeNode(sg)
    }
  }
}

function createGeomForSubgraphs(graph: Graph) {
  for (const sg of graph.subgraphs()) {
    if (GeomGraph.getGeom(sg) == null && sg.hasSomeAttrOnIndex(GeomObject.attachIndex)) {
      new GeomGraph(sg)
    }
  }

  if (GeomGraph.getGeom(graph) == null && graph.hasSomeAttrOnIndex(GeomGraph.attachIndex)) {
    new GeomGraph(graph)
  }
}
/** Exports the graph into a JSONGraph object for further serialization */
export function graphToJSON(graph: Graph): JSONGraph {
  /** idToLevels are needed to figure out the edge membership efficiently:
   * Edge belongs to the first Graph which is a common ancestor of the edge source and the edge target.
   */
  const idToLevels = getNodeLevels(graph)
  return {type: getGraphType(graph), id: graph.id, children: createChildren(graph, idToLevels)}
}

function edgeStmt(edge: Edge): EdgeStmt {
  //create edge_list from one element
  return {
    type: 'edge_stmt',
    edge_list: [
      {type: 'node_id', id: edge.source.id},
      {type: 'node_id', id: edge.target.id},
    ],
    attr_list: Array.from(getEdgeAttrs(edge)),
  }
}
function createChildren(graph: Graph, nodeLevels: Map<string, number>): Array<Stmt> {
  const idToStmt = new Map<string, Stmt>()
  const children = []
  // fill the map of idToStmh
  for (const n of graph.deepNodes) {
    idToStmt.set(n.id, getNodeStatement(n))
  }
  // attach node and subgraphs stmts to their parents
  for (const n of graph.deepNodes) {
    if (n.parent == graph) {
      continue
    }
    const subGraph = idToStmt.get((n.parent as Graph).id) as Subgraph
    subGraph.children.push(idToStmt.get(n.id))
  }
  // attach edge statements to their parents
  for (const e of graph.deepEdges()) {
    const es = edgeStmt(e)
    const parent: Node = edgeParent(e, nodeLevels)
    if (parent == graph) {
      children.push(es)
    } else {
      const subGraph = idToStmt.get(parent.id) as Subgraph
      subGraph.children.push(es)
    }
  }
  for (const n of graph.shallowNodes) {
    children.push(idToStmt.get(n.id))
  }
  return children
}

function* getEdgeAttrs(edge: Edge): IterableIterator<Attr> {
  const geomEdge = GeomObject.getGeom(edge) as GeomEdge
  if (geomEdge && geomEdge.curve) {
    yield {type: 'attr', id: 'edgeCurve', eq: JSON.stringify(iCurveToJSON(geomEdge.curve))}

    if (geomEdge.sourceArrowhead) {
      yield {type: 'attr', id: 'sourceArrowhead', eq: JSON.stringify(geomEdge.sourceArrowhead.tipPosition.toJSON())}
    }

    if (geomEdge.targetArrowhead) {
      yield {type: 'attr', id: 'targetArrowhead', eq: JSON.stringify(geomEdge.targetArrowhead.tipPosition.toJSON())}
    }
  }
  yield* drawingObjAttrIter(edge)
}

function getNodeStatement(node: Node): NodeStmt | Subgraph {
  const isGraph = node instanceof Graph
  if (!isGraph) {
    return {
      type: 'node_stmt',
      node_id: {type: 'node_id', id: node.id},
      attr_list: Array.from(getNodeAttrList(node)),
    }
  } else {
    const attr_list = Array.from(getNodeAttrList(node))
    const children = []
    const attr_stmt: AttrStmt = {type: 'attr_stmt', target: 'graph', attr_list: attr_list}
    children.push(attr_stmt)
    return {type: 'subgraph', children: children, id: node.id}
  }
}

function getNodeBoundaryCurve(node: Node): Attr {
  const bc = (<GeomNode>GeomNode.getGeom(node)).boundaryCurve
  return {type: 'attr', id: 'boundaryCurve', eq: JSON.stringify(iCurveToJSON(bc))}
}

function* getNodeAttrList(node: Node): IterableIterator<Attr> {
  const geomNode = GeomObject.getGeom(node) as GeomNode
  if (geomNode && geomNode.boundaryCurve) {
    yield getNodeBoundaryCurve(node)
  }
  yield* drawingObjAttrIter(node)
}

function* drawingObjAttrIter(node: Entity) {
  const drawingObj = DrawingObject.getDrawingObj(node)
  if (drawingObj) {
    for (const attr of drawingObj.attrIter()) {
      yield attr
    }
  }
}

function getGraphType(graph: Graph): 'digraph' | 'graph' {
  for (const e of graph.deepEdges()) {
    const de = DrawingEdge.getDrawingObj(e)
    if (de == null) return 'digraph'
    if ((de.arrowhead && de.arrowhead != ArrowTypeEnum.none) || (de.arrowtail && de.arrowtail != ArrowTypeEnum.none)) return 'digraph'
  }
  return 'graph' // it seems that edges do not have direction
}
function edgeParent(e: Edge, nodeLevels: Map<string, number>): Node {
  // make the levels equal
  let s = e.source
  let t = e.target
  let sLevel = nodeLevels.get(s.id)
  let tLevel = nodeLevels.get(t.id)
  while (sLevel > tLevel) {
    s = s.parent as Node
    sLevel--
  }
  while (sLevel < tLevel) {
    t = t.parent as Node
    tLevel--
  }
  // Assert.assert(sLevel == tLevel)
  while (s.parent != t.parent) {
    s = s.parent as Node
    t = t.parent as Node
  }

  return s.parent as Node
}
/** The nodes belonging to the root graph have levels 0,
 * In general, a node level is the distance, the number of hops,
 *  from its parent to the root in the
 * tree of graphs.
 */
function getNodeLevels(graph: Graph): Map<string, number> {
  const levels = new Map<string, number>()
  levels.set(graph.id, 0)
  getNodeLevelsOnMap(graph, levels)
  return levels
}

function getNodeLevelsOnMap(graph: Graph, levels: Map<string, number>): void {
  const graphLevel = levels.get(graph.id) + 1
  for (const n of graph.shallowNodes) {
    levels.set(n.id, graphLevel)
    if (n instanceof Graph) {
      getNodeLevelsOnMap(n, levels)
    }
  }
}

function getOrCreateGeomObj(entity: Entity): GeomObject {
  return GeomObject.getGeom(entity) ?? createNewGeomObj(entity)
}
function createNewGeomObj(entity: Entity): GeomObject {
  if (entity instanceof Graph) {
    return new GeomGraph(entity)
  }
  if (entity instanceof Node) {
    return new GeomNode(entity)
  }

  if (entity instanceof Edge) {
    return new GeomEdge(entity)
  }
  throw new Error('unsupported type ' + entity)
}
