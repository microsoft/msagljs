import {Graph} from '../../structs/graph'
import {Edge} from '../../structs/edge'
import {Node} from '../../structs/node'
import {GeomEdge} from './geomEdge'
import {GeomLabel} from './geomLabel'
import {GeomNode} from './geomNode'
import {GeomGraph} from './geomGraph'
import {Point} from '../../math/geometry/point'
import {Rectangle} from '../../math/geometry/rectangle'
import {ICurve} from '../../math/geometry/icurve'
import {ICurveJSONTyped, iCurveToJSON, JSONToICurve} from '../../math/geometry/icurve'
import {IntPairMap} from '../../utils/IntPairMap'
import {TileMap} from './tileMap'
import {Tile} from './tile'
import {CurveClip} from './tileMap'

type PointT = [number, number]
type RectT = [number, number, number, number]

type TileDTO = {
  rect: RectT
  nodes: string[]
  labels: {edgeIdx: number}[]
  arrowheads: {edgeIdx: number; tip: PointT; base: PointT}[]
  curveClips: {edgeIdx: number; curve: ICurveJSONTyped}[]
}

type LevelDTO = {x: number; y: number; tile: TileDTO}[]

export type TileMapDTO = {
  rootTile: RectT
  levels: LevelDTO[]
  sortedNodeIds: string[]
  numberOfNodesOnLevel: number[]
  nodeRank: [string, number][]
  nodeScales: [string, number][][]
}

function rectToArr(r: Rectangle): RectT {
  return [r.left, r.bottom, r.right, r.top]
}

function arrToRect(a: RectT): Rectangle {
  return new Rectangle({left: a[0], bottom: a[1], right: a[2], top: a[3]})
}

function ptToArr(p: Point): PointT {
  return [p.x, p.y]
}

function arrToPt(a: PointT): Point {
  return new Point(a[0], a[1])
}

function buildEdgeIndex(graph: Graph): Map<Edge, number> {
  const m = new Map<Edge, number>()
  let i = 0
  for (const e of graph.deepEdges) m.set(e, i++)
  return m
}

function buildEdgeArray(graph: Graph): Edge[] {
  const arr: Edge[] = []
  for (const e of graph.deepEdges) arr.push(e)
  return arr
}

export function serializeTileMap(tm: TileMap, graph: Graph): TileMapDTO {
  // Access private fields via type assertion.
  const anyTm = tm as any
  const edgeIdx = buildEdgeIndex(graph)

  const levels: LevelDTO[] = []
  const lvls: IntPairMap<Tile>[] = anyTm.levels
  for (const lvl of lvls) {
    const arr: LevelDTO = []
    for (const [key, tile] of lvl.keyValues()) {
      arr.push({x: key.x, y: key.y, tile: serializeTile(tile, edgeIdx)})
    }
    levels.push(arr)
  }

  const sortedNodes: Node[] = anyTm.sortedNodes || []
  const sortedNodeIds = sortedNodes.map((n) => n.id)

  const nodeRank: [string, number][] = []
  if (anyTm.nodeRank) {
    for (const [n, r] of anyTm.nodeRank) nodeRank.push([n.id, r])
  }

  const nodeScales: [string, number][][] = []
  const nsArr: Map<Node, number>[] = anyTm.nodeScales || []
  for (const m of nsArr) {
    const entries: [string, number][] = []
    if (m) for (const [n, s] of m) entries.push([n.id, s])
    nodeScales.push(entries)
  }

  return {
    rootTile: rectToArr(anyTm.topLevelTileRect),
    levels,
    sortedNodeIds,
    numberOfNodesOnLevel: anyTm.numberOfNodesOnLevel || [],
    nodeRank,
    nodeScales,
  }
}

function serializeTile(tile: Tile, edgeIdx: Map<Edge, number>): TileDTO {
  const nodeIds: string[] = []
  for (const gn of tile.nodes) {
    if (gn && gn.node) nodeIds.push(gn.node.id)
  }
  const labels: {edgeIdx: number}[] = []
  for (const lab of tile.labels) {
    const e = labelToEdge(lab)
    if (e) {
      const idx = edgeIdx.get(e)
      if (idx !== undefined) labels.push({edgeIdx: idx})
    }
  }
  const arrowheads: {edgeIdx: number; tip: PointT; base: PointT}[] = []
  for (const ah of tile.arrowheads) {
    const idx = edgeIdx.get(ah.edge)
    if (idx === undefined) continue
    arrowheads.push({edgeIdx: idx, tip: ptToArr(ah.tip), base: ptToArr(ah.base)})
  }
  const curveClips: {edgeIdx: number; curve: ICurveJSONTyped}[] = []
  for (const cc of tile.curveClips) {
    const idx = edgeIdx.get(cc.edge)
    if (idx === undefined) continue
    curveClips.push({edgeIdx: idx, curve: iCurveToJSON(cc.curve)})
  }
  return {
    rect: rectToArr(tile.rect),
    nodes: nodeIds,
    labels,
    arrowheads,
    curveClips,
  }
}

function labelToEdge(label: GeomLabel): Edge | null {
  // GeomLabel is attached to an Edge's Label structure via AttributeRegistry.
  // We walk back via the owning attribute parent if available; otherwise
  // return null and accept occasional label loss.
  const anyLab = label as any
  // Most pragmatic: the label's parent is the edge's Label struct with `.parent` = Edge.
  const structLabel = anyLab?.entity
  if (structLabel && structLabel.parent && structLabel.parent instanceof Edge) {
    return structLabel.parent
  }
  return null
}

export function deserializeTileMap(graph: Graph, dto: TileMapDTO): TileMap {
  const geomGraph = GeomGraph.getGeom(graph)
  const rootTile = arrToRect(dto.rootTile)
  const tm = new TileMap(geomGraph, rootTile)
  const anyTm = tm as any

  const edges = buildEdgeArray(graph)
  const nodeById = new Map<string, Node>()
  for (const n of graph.nodesBreadthFirst) nodeById.set(n.id, n)

  const levels: IntPairMap<Tile>[] = []
  for (const lvl of dto.levels) {
    const ipm = new IntPairMap<Tile>()
    for (const {x, y, tile: tdto} of lvl) {
      ipm.set(x, y, hydrateTile(tdto, edges, nodeById))
    }
    levels.push(ipm)
  }
  anyTm.levels = levels

  anyTm.sortedNodes = dto.sortedNodeIds.map((id) => nodeById.get(id)).filter((n) => !!n)
  anyTm.nodeIndexInSortedNodes = new Map<Node, number>()
  for (let i = 0; i < anyTm.sortedNodes.length; i++) {
    anyTm.nodeIndexInSortedNodes.set(anyTm.sortedNodes[i], i)
  }

  anyTm.numberOfNodesOnLevel = dto.numberOfNodesOnLevel.slice()

  const nodeRank = new Map<Node, number>()
  for (const [id, r] of dto.nodeRank) {
    const n = nodeById.get(id)
    if (n) nodeRank.set(n, r)
  }
  anyTm.nodeRank = nodeRank

  const nodeScales: Map<Node, number>[] = []
  for (const entries of dto.nodeScales) {
    const m = new Map<Node, number>()
    for (const [id, s] of entries) {
      const n = nodeById.get(id)
      if (n) m.set(n, s)
    }
    nodeScales.push(m)
  }
  anyTm.nodeScales = nodeScales

  return tm
}

function hydrateTile(dto: TileDTO, edges: Edge[], nodeById: Map<string, Node>): Tile {
  const tile = new Tile(arrToRect(dto.rect))
  // nodes
  for (const id of dto.nodes) {
    const n = nodeById.get(id)
    if (!n) continue
    const gn = GeomNode.getGeom(n)
    if (gn) tile.nodes.push(gn)
  }
  // labels
  for (const {edgeIdx} of dto.labels) {
    const e = edges[edgeIdx]
    if (!e) continue
    const ge = GeomEdge.getGeom(e) as GeomEdge
    const gl = ge ? ge.label : null
    if (gl) tile.labels.push(gl)
  }
  // arrowheads
  for (const ah of dto.arrowheads) {
    const e = edges[ah.edgeIdx]
    if (!e) continue
    tile.arrowheads.push({edge: e, tip: arrToPt(ah.tip), base: arrToPt(ah.base)})
  }
  // curveClips
  const clips: CurveClip[] = []
  for (const cc of dto.curveClips) {
    const e = edges[cc.edgeIdx]
    if (!e) continue
    const curve: ICurve = JSONToICurve(cc.curve)
    clips.push({curve, edge: e, startPar: curve.parStart, endPar: curve.parEnd})
  }
  tile.curveClips = clips
  return tile
}
