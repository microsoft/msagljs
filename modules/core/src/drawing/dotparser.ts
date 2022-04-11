import parse from 'dotparser'
import parseColor from 'parse-color'
import {Edge, Graph, LayerDirectionEnum, Node} from '..'
import {Label} from '../structs/label'

import {ArrowTypeEnum} from './arrowTypeEnum'
import {Color} from './color'
import {DrawingEdge} from './drawingEdge'
import {DrawingGraph} from './drawingGraph'
import {DrawingLabel} from './drawingLabel'
import {DrawingNode} from './drawingNode'
import {DrawingObject} from './drawingObject'
import {RankEnum} from './rankEnum'
import {ShapeEnum} from './shapeEnum'
import {StyleEnum} from './styleEnum'

export enum OrderingEnum {
  in,
  out,
}

export enum DirTypeEnum {
  forward,
  back,

  both,

  none,
}

function parseEdge(so: any, to: any, dg: DrawingGraph, directed: boolean, o: any): DrawingEdge[] {
  const nc = dg.graph.nodeCollection
  let sn: Node
  let tn: Node
  if (so.type == 'node_id') {
    const s = so.id.toString()
    if (!nc.hasNode(s)) {
      dg.graph.addNode((sn = new Node(s)))
      const dn = new DrawingNode(sn)
      dn.labelText = s
    } else {
      sn = nc.getNode(s)
    }
  } else {
    const drObjs = []
    for (const ch of so.children) {
      if (ch.type === 'node_stmt') {
        for (const e of parseEdge(ch.node_id, to, dg, directed, o)) drObjs.push(e)
      } else if (ch.type === 'attr_stmt') {
      } else {
        throw new Error('not implemented')
      }
    }
    for (const ch of so.children) {
      if (ch.type === 'attr_stmt') {
        for (const drObj of drObjs) fillDrawingObjectAttrs(ch, drObj)
      } // ignore anything else
    }
    return drObjs
  }
  if (to.type == 'node_id') {
    const t = to.id.toString()
    if (!nc.hasNode(t)) {
      dg.graph.addNode((tn = new Node(t)))
      const dn = new DrawingNode(tn)
      dn.labelText = t
    } else {
      tn = nc.getNode(t)
    }
  } else if (to.type == 'subgraph') {
    const drObjs = new Array<DrawingEdge>()
    for (const ch of to.children) {
      if (ch.type === 'node_stmt') {
        for (const e of parseEdge(so, ch.node_id, dg, directed, o)) drObjs.push(e)
      } else if (ch.type === 'attr_stmt') {
      } else {
        throw new Error('not implemented')
      }
    }
    for (const ch of to.children) {
      if (ch.type === 'attr_stmt') {
        for (const drObj of drObjs) fillDrawingObjectAttrs(ch, drObj)
      } // ignore anything else
    }
    return drObjs
  }
  const edge = new Edge(sn, tn)
  nc.addEdge(edge)
  const drawingEdge = new DrawingEdge(edge)
  fillDrawingObjectAttrs(o, drawingEdge)
  if (drawingEdge.labelText) {
    edge.label = new Label(drawingEdge.labelText)
    drawingEdge.label = new DrawingLabel(drawingEdge.labelText)
  }
  drawingEdge.directed = directed
  return [drawingEdge]
}

function parseGraph(o: any, dg: DrawingGraph, directed: boolean) {
  parseUnderGraph(o.children, dg, directed)
}

function parseNode(o: any, dg: DrawingGraph): DrawingNode {
  const id = o.node_id.id.toString()
  let node = dg.graph.findNode(id)
  let drawingNode: DrawingNode
  if (node) {
    drawingNode = <DrawingNode>DrawingObject.getDrawingObj(node)
    if (!drawingNode) drawingNode = new DrawingNode(node)
  } else {
    node = new Node(id)
    dg.graph.addNode(node)
    drawingNode = new DrawingNode(node)
  }
  fillDrawingObjectAttrs(o, drawingNode)
  return drawingNode
}
function fillDrawingObjectAttrs(o: any, drawingObj: DrawingObject) {
  if (o.attr_list == null) return
  for (const attr of o.attr_list) {
    if (attr.type == 'attr') {
      const str = attr.eq
      switch (attr.id) {
        case 'color':
          drawingObj.color = localParseColor(str)
          break
        case 'pencolor':
          drawingObj.pencolor = localParseColor(str)
          break
        case 'labelfontcolor':
          drawingObj.labelfontcolor = localParseColor(str)
          break
        case 'fontcolor':
          drawingObj.fontColor = localParseColor(str)
          break
        case 'fillcolor':
          drawingObj.fillColor = localParseColor(str)
          break
        case 'style':
          drawingObj.styleEnum = styleEnumFromString(str)
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
          } else if (typeof str == 'number') {
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
          drawingObj.bgcolor = localParseColor(str)
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
          drawingObj.id = str
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

function parseUnderGraph(children: any, dg: DrawingGraph, directed: boolean) {
  for (const o of children) {
    switch (o.type) {
      case 'node_stmt':
        parseNode(o, dg)
        break
      case 'edge_stmt':
        {
          const edgeList: any[] = o.edge_list
          for (let i = 0; i < edgeList.length - 1; i++) parseEdge(edgeList[i], edgeList[i + 1], dg, directed, o)
        }
        break
      case 'subgraph':
        // is it really a subgraph?
        if (process_same_rank(o, dg)) {
        } else if (o.id == null) {
          const entities: DrawingObject[] = getEntitiesSubg(o, dg, directed)
          applyAttributesToEntities(o, dg, entities)
        } else {
          const subg = new Graph(o.id)
          const sdg = new DrawingGraph(subg)
          parseGraph(o, sdg, directed)
          if (!subg.isEmpty()) dg.graph.addNode(subg)
        }
        break
      case 'attr_stmt':
        parseGraphAttr(o, dg)
        break
      default:
        throw new Error('not implemented')
    }
  }
}

export function parseDotString(graphStr: string): DrawingGraph {
  const ast = parse(graphStr)
  if (ast == null) return null

  const graph = new Graph()
  const drawingGraph = new DrawingGraph(graph)
  parseUnderGraph(ast[0].children, drawingGraph, ast[0].type == 'digraph')
  return drawingGraph
}

function process_same_rank(o: any, dg: DrawingGraph): boolean {
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
        const e = o.children[i]
        dg.graphVisData.minRanks.push(e.id)
      }
      return true

    case 'max':
      for (let i = 1; i < o.children.length; i++) {
        const e = o.children[i]
        dg.graphVisData.maxRanks.push(e.id)
      }
      return true

    case 'same': {
      const sameRankIds = []
      for (let i = 1; i < o.children.length; i++) {
        const e = o.children[i]
        sameRankIds.push(e.id)
      }
      dg.graphVisData.sameRanks.push(sameRankIds)
      return true
    }
    case 'source': {
      for (let i = 1; i < o.children.length; i++) {
        const e = o.children[i]
        dg.graphVisData.sourceRanks.push(e.id)
      }
      return true
    }
    case 'sink':
      {
        for (let i = 1; i < o.children.length; i++) {
          const e = o.children[i]
          dg.graphVisData.sinkRanks.push(e.id)
        }
      }
      return true
    default:
      throw new Error('incorrect rank')
      return false
  }
}
function localParseColor(s: string): Color {
  const p = parseColor(s)
  if (p != null) {
    if (p.rgba != null) {
      return new Color(p.rgba[3] * 255, p.rgba[0], p.rgba[1], p.rgba[2])
    }
    if (p.rgb != null) {
      return Color.mkRGB(p.rgb[0], p.rgb[1], p.rgb[2])
    }
  }
  if (p.keyword != null) {
    return Color.parse(p.keyword)
  }
  return Color.Black
}
function parseGraphAttr(o: any, dg: DrawingGraph) {
  if (dg.defaultNode == null && o.target == 'node') {
    dg.defaultNode = new DrawingNode(null)
    fillDrawingObjectAttrs(o, dg.defaultNode)
  } else if (o.target == 'graph') {
    fillDrawingObjectAttrs(o, dg)
  }
}

function styleEnumFromString(t: string): StyleEnum {
  const typedStyleString = t as keyof typeof StyleEnum
  return StyleEnum[typedStyleString]
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
function getEntitiesSubg(o: any, dg: DrawingGraph, directed: boolean): DrawingObject[] {
  let ret: DrawingObject[] = []
  for (const ch of o.children) {
    if (ch.type == 'edge_stmt') {
      const edgeList: any[] = ch.edge_list
      for (let i = 0; i < edgeList.length - 1; i++) {
        for (const e of parseEdge(edgeList[i], edgeList[i + 1], dg, directed, ch)) ret.push(e)
      }
    } else if (ch.type == 'attr_stmt') {
    } else if (ch.type == 'node_stmt') {
      ret.push(parseNode(ch, dg))
    } else if (ch.type === 'subgraph') {
      if (ch.id != null) {
        const subg = new Graph(ch.id)
        dg.graph.addNode(subg)
        const sdg = new DrawingGraph(subg)
        parseGraph(ch, sdg, directed)
        ret.push(sdg)
      } else {
        ret = ret.concat(getEntitiesSubg(ch, dg, directed))
      }
    } else {
      throw new Error('Function not implemented.')
    }
  }
  return ret
}

function applyAttributesToEntities(o: any, dg: DrawingGraph, entities: DrawingObject[]) {
  for (const ch of o.children) {
    if (ch.type == 'attr_stmt') {
      for (const ent of entities) fillDrawingObjectAttrs(ch, ent)
    }
  }
}
