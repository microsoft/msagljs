import {pageRank} from '../../structs/graph'
import {Rectangle} from '../../math/geometry/rectangle'
import {GeomNode} from './geomNode'
import {GeomEdge} from './geomEdge'
import {Edge} from '../../structs/edge'
import {IntPairMap} from '../../utils/IntPairMap'
import {clipWithRectangleInsideInterval} from '../../math/geometry/curve'
import {GeomLabel} from './geomLabel'
import {Point} from '../../math/geometry/point'
import {GeomGraph} from '.'
import {ICurve} from '../../math/geometry'
import {Node} from '../../structs/node'
import {Entity} from '../../structs/entity'
/** Represents a part of the curve containing in a tile.
 * One tile can have several parts of clips corresponding to the same curve.
 */
export type CurveClip = {startPar: number; endPar: number; curve: ICurve; edge: Edge}
/** keeps all the data needed to render a tile */
export type TileData = {
  curveClips: CurveClip[] // the curves are ranked
  arrowheads: {tip: Point; edge: Edge; base: Point}[]
  nodes: GeomNode[]
  labels: GeomLabel[]
  rect: Rectangle // it seems needed only for debug
}
export function tileIsEmpty(sd: TileData): boolean {
  return sd.arrowheads.length === 0 && sd.curveClips.length === 0 && sd.nodes.length === 0
}

/** keeps the data needed to render the tile hierarchy */
export class TileMap {
  /** the maximal number entities vizible in a tile */
  tileCapacity = 500
  /**
   * To choose entities visible on level z we iterate over all non-empty tiles from the level z+1, and pick the most ranked entity from each such tile of this level. If we pick an edge we also pick its source and target
   *
   */
  private dataArray: IntPairMap<TileData>[] = []
  edgeCount: number
  /** retrieves the data for a single tile(x-y-z) */
  getTileData(x: number, y: number, z: number): TileData {
    const mapOnLevel = this.dataArray[z]
    if (!mapOnLevel) return null
    return mapOnLevel.get(x, y)
  }

  *getTilesOfLevel(z: number): IterableIterator<{x: number; y: number; data: TileData}> {
    const tm = this.dataArray[z]
    if (tm == null) return
    for (const [key, val] of tm.keyValues()) {
      yield {x: key.x, y: key.y, data: val}
    }
  }

  geomGraph: GeomGraph
  topLevelTileRect: Rectangle
  constructor(geomGraph: GeomGraph, topLevelTileRect: Rectangle) {
    this.geomGraph = geomGraph
    this.topLevelTileRect = topLevelTileRect
    this.fillTopLevelTile()
    this.edgeCount = geomGraph.graph.deepEdgesCount()
  }

  private fillTopLevelTile() {
    const tileMap = new IntPairMap<TileData>(1)
    let edges = Array.from(this.geomGraph.graph.deepEdges)
    const rank = pageRank(this.geomGraph.graph, 0.85)

    edges = edges.sort((u: Edge, v: Edge) => {
      const rv = rank.get(v.source) + rank.get(v.target)
      const ru = rank.get(u.source) + rank.get(u.target)
      return ru - rv
    })
    const curveClips = edges.map((e) => {
      const c = GeomEdge.getGeom(e).curve
      return {startPar: c.parStart, endPar: c.parEnd, curve: c, edge: e}
    })

    const arrows = []
    const geomLabels = []
    for (const e of edges) {
      const geomEdge = GeomEdge.getGeom(e)
      if (geomEdge.sourceArrowhead) {
        arrows.push({edge: geomEdge.edge, tip: geomEdge.sourceArrowhead.tipPosition, base: geomEdge.curve.start})
      }
      if (geomEdge.targetArrowhead) {
        arrows.push({edge: geomEdge.edge, tip: geomEdge.targetArrowhead.tipPosition, base: geomEdge.curve.end})
      }
      if (geomEdge.label) {
        geomLabels.push(geomEdge.label)
      }
    }
    // geomLabels and arrowheads are sorted, because edges are sorted: all arrays of TileData are sorted by rank

    const sortedNodes = Array.from(rank.keys())
    sortedNodes.sort((a: Node, b: Node) => rank.get(a) - rank.get(b))
    const data: TileData = {
      curveClips: curveClips,
      arrowheads: arrows,
      nodes: sortedNodes.map((n) => GeomNode.getGeom(n)),
      labels: geomLabels,
      rect: this.topLevelTileRect,
    }
    tileMap.set(0, 0, data)
    this.dataArray.push(tileMap)
  }
  /** creates tilings for levels from 0 to z, including the level z
   */
  buildUpToLevel(z: number) {
    // level 0 is filled in the constructor
    for (let i = 1; i <= z; i++) {
      if (this.subdivideToLevel(i)) break
    }
    for (let i = 0; i < this.dataArray.length - 1; i++) {
      this.filterOutEntities(this.dataArray[i], this.dataArray[i + 1])
    }
  }
  filterOutEntities(levelToReduce: IntPairMap<TileData>, pixelLevel: IntPairMap<TileData>) {
    const visibleSet = new Set<Entity>()
    for (const tile of pixelLevel.values()) {
      for (const e of this.topEntitiesFromTile(tile)) {
        visibleSet.add(e)
      }
    }
    const tileArray = Array.from(levelToReduce.keyValues())
    for (const [k, t] of tileArray) {
      const ft = this.filteredTile(t, visibleSet)
      if (tileIsEmpty(ft)) {
        levelToReduce.delete(k.x, k.y)
      } else {
        levelToReduce.set(k.x, k.y, ft)
      }
    }
  }
  filteredTile(t: TileData, visibleSet: Set<Entity>): TileData {
    const ft: TileData = {
      curveClips: t.curveClips.filter((c) => visibleSet.has(c.edge)),
      arrowheads: t.arrowheads.filter((a) => visibleSet.has(a.edge)),
      nodes: t.nodes.filter((n) => visibleSet.has(n.node)),
      labels: t.labels.filter((l) => visibleSet.has((l.parent as GeomEdge).edge)),
      rect: t.rect,
    }
    return ft
  }
  *topEntitiesFromTile(tile: TileData): IterableIterator<Entity> {
    if (tile.curveClips.length > 0) {
      const cc = tile.curveClips[0]
      yield cc.edge
      if (cc.edge.label) {
        yield cc.edge.label
      }
      yield cc.edge.source
      yield cc.edge.target
    }
    if (tile.nodes.length > 0) {
      yield tile.nodes[0].node
    }

    if (tile.labels.length > 0) {
      yield tile.labels[0].parent.entity
    }

    if (tile.arrowheads.length > 0) {
      yield tile.arrowheads[0].edge
    }
  }
  /** It is assumed that the previous levels have been calculated.
   * Returns true if every edge is appears in some tile as the first edge
   */
  subdivideToLevel(z: number): boolean {
    let allTilesAreSmall = true
    const tilesInRow = Math.pow(2, z)
    const levelTiles = (this.dataArray[z] = new IntPairMap<TileData>(tilesInRow))
    /** the width and the height of the previous level tile */
    let w = this.topLevelTileRect.width
    let h = this.topLevelTileRect.height
    for (let i = 0; i < z - 1; i++) {
      w /= 2
      h /= 2
    }
    /** the width and the height of z-th level tile */
    const wz = w / 2
    const hz = h / 2

    for (const [key, tile] of this.dataArray[z - 1].keyValues()) {
      const xp = key.x
      const yp = key.y
      const left = this.topLevelTileRect.left + xp * w
      const bottom = this.topLevelTileRect.bottom + yp * h
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const tileRect = new Rectangle({
            left: left + wz * i,
            right: left + wz * (i + 1),
            bottom: bottom + hz * j,
            top: bottom + hz * (j + 1),
          })
          const tileData: TileData = this.generateSubTile(tile, tileRect)
          if (tileData) {
            levelTiles.set(2 * xp + i, 2 * yp + j, tileData)
            if (allTilesAreSmall && numberOfEntitiesInTile(tileData) > this.tileCapacity) {
              allTilesAreSmall = false
            }
          }
        }
    }

    return allTilesAreSmall
  }

  generateSubTile(upperTile: TileData, tileRect: Rectangle): TileData {
    const sd: TileData = {nodes: [], arrowheads: [], labels: [], curveClips: [], rect: tileRect}
    for (const n of upperTile.nodes) {
      if (n.boundingBox.intersects(tileRect)) {
        sd.nodes.push(n)
      }
    }

    for (const lab of upperTile.labels) {
      if (lab.boundingBox.intersects(tileRect)) {
        sd.labels.push(lab)
      }
    }
    for (const clip of upperTile.curveClips) {
      for (const newClip of clipWithRectangleInsideInterval(clip.curve, clip.startPar, clip.endPar, tileRect)) {
        sd.curveClips.push({curve: clip.curve, startPar: newClip.start, endPar: newClip.end, edge: clip.edge})
      }
    }
    for (const arrowhead of upperTile.arrowheads) {
      const arrowheadBox = Rectangle.mkPP(arrowhead.base, arrowhead.tip)
      const d = arrowhead.tip.sub(arrowhead.base).div(3)
      const dRotated = d.rotate90Cw()
      arrowheadBox.add(arrowhead.base.add(dRotated))
      arrowheadBox.add(arrowhead.base.sub(dRotated))
      if (arrowheadBox.intersects(tileRect)) sd.arrowheads.push(arrowhead)
    }
    if (!tileIsEmpty(sd)) {
      return sd
    }
  }
}
/** refine it later */
function numberOfEntitiesInTile(t: TileData): number {
  return t.curveClips.length + t.nodes.length
}
