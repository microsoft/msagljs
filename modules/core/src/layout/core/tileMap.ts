import {pageRank} from '../../structs/graph'
import {Rectangle, Size} from '../../math/geometry/rectangle'
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
import {TileData} from './tileData'
/** Represents a part of the curve containing in a tile.
 * One tile can have several parts of clips corresponding to the same curve.
 */
export type CurveClip = {startPar: number; endPar: number; curve: ICurve; edge: Edge}
export type ArrowHeadData = {tip: Point; edge: Edge; base: Point}
type EntityDataInTile = {tile: TileData; data: CurveClip | ArrowHeadData | GeomLabel | GeomNode}
export function tileIsEmpty(sd: TileData): boolean {
  return sd.arrowheads.length === 0 && sd.curveClips.length === 0 && sd.nodes.length === 0
}

/** keeps the data needed to render the tile hierarchy */
export class TileMap {
  visualRank = new Map<Entity, number>()
  /** stop generating new tiles when the tiles on the level has size that is less than minTileSize :
   * t.width <= this.minTileSize.width && t.height <= this.minTileSize.height
   */
  private minTileSize: Size
  /** Stop generating new tiles when every subdivided tile has at most tileCapacityMin elements.
   *  In addition, the tiles containing not more than tileCapacityMin are not subdivided anymore:
   *  their elements are reused.
   */
  private tileCapacityMin = 100
  /** the maximal number entities vizible in a tile */
  private tileCapacity = 1000
  /**
   * To choose entities visible on level z we iterate over all non-empty tiles from the level z+1, and pick the most ranked entity from each such tile of this level. If we pick an edge we also pick its source and target
   *
   */
  private dataArray: IntPairMap<TileData>[] = []

  edgeCount: number
  pageRank: Map<Entity, number>
  sortedEntities: Entity[]
  entsSortedByVisualAndPageRank: Entity[]
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
    this.minTileSize = this.getMinTileSize()
  }
  getMinTileSize(): Size {
    let w = 0
    let h = 0
    let n = 0
    for (const node of this.geomGraph.nodesBreadthFirst) {
      if (node instanceof GeomGraph) continue
      if (n == 0) {
        w = node.width
        h = node.height
      } else {
        w = (n * w + node.width) / (n + 1)
        h = (n * h + node.height) / (n + 1)
      }
      n++
    }
    return new Size(w * 1.5, h * 1.5)
  }

  private fillTopLevelTile() {
    const tileMap = new IntPairMap<TileData>(1)
    const rank = pageRank(this.geomGraph.graph, 0.85)
    this.pageRank = new Map<Edge, number>()
    this.sortedEntities = new Array<Entity>()
    for (const e of this.geomGraph.graph.deepEdges) {
      this.pageRank.set(e, rank.get(e.source) + rank.get(e.target))
      this.sortedEntities.push(e)
      if (e.label) {
        this.sortedEntities.push(e.label)
        this.pageRank.set(e.label, rank.get(e.source) + rank.get(e.target))
      }
    }
    for (const n of this.geomGraph.graph.nodesBreadthFirst) {
      this.sortedEntities.push(n)
      const nodeRank = rank.get(n)
      this.pageRank.set(n, 2 * nodeRank) // to be comparable with the edges
    }

    this.sortedEntities.sort((u: Entity, v: Entity) => this.pageRank.get(u) - this.pageRank.get(v))
    const topLevelTile = new TileData()

    const edges = this.sortedEntities.filter((e) => e instanceof Edge) as Array<Edge>

    topLevelTile.curveClips = []

    const arrows = (topLevelTile.arrowheads = new Array<{tip: Point; edge: Edge; base: Point}>())
    const geomLabels = (topLevelTile.labels = new Array<GeomLabel>())
    for (const e of edges) {
      const geomEdge = GeomEdge.getGeom(e)
      const c = GeomEdge.getGeom(e).curve
      topLevelTile.curveClips.push({startPar: c.parStart, endPar: c.parEnd, curve: c, edge: e})
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

    topLevelTile.nodes = this.sortedEntities.filter((e) => e instanceof Node).map((n) => GeomNode.getGeom(n))
    topLevelTile.rect = this.topLevelTileRect

    tileMap.set(0, 0, topLevelTile)
    this.dataArray.push(tileMap)
  }
  /**
   * Creates tilings for levels from 0 to z, including the level z.
   * The method does not necesserely creates all levels until z, but can exit earlier
   *  if all tiles either has size smaller or equal than this.minTileSize or have at most this.tileCapacityMin elements
   */
  buildUpToLevel(z: number) {
    // level 0 is filled in the constructor
    for (let i = 1; i <= z; i++) {
      if (this.subdivideToLevel(i)) {
        break
      }
    }
    this.calculateVisualRank()
    this.entsSortedByVisualAndPageRank = Array.from(this.visualRank.keys()).sort((u, v) => this.compareByVisPageRanks(u, v))
    for (let i = this.dataArray.length - 1; i > 0; i--) {
      this.filterOutEntities(this.dataArray[i - 1], this.dataArray[i])
    }
  }
  compareByVisPageRanks(u: Entity, v: Entity): number {
    const uVis = this.visualRank.get(u)
    const vVis = this.visualRank.get(v)
    if (uVis > vVis) {
      return -1
    }
    if (uVis < vVis) {
      return 1
    }
    return this.pageRank.get(v) - this.pageRank.get(u)
  }

  calculateVisualRank() {
    for (const level of this.dataArray) {
      for (const tile of level.values()) {
        this.calculateVisualRankOnTile(tile)
      }
    }
  }
  calculateVisualRankOnTile(tile: TileData) {
    const rankAdditionOfTile = 1 / tile.elementCount
    for (const e of tile.entitiesOfTile()) {
      const rank = this.visualRank.get(e)
      if (!rank) {
        this.visualRank.set(e, rankAdditionOfTile)
      } else {
        this.visualRank.set(e, rankAdditionOfTile + rank)
      }
    }
  }

  filterOutEntities(levelToReduce: IntPairMap<TileData>, prevLevel: IntPairMap<TileData>) {
    // create a map,edgeToIndexOfPrevLevel, from the prevLevel edges to integers,
    // For each edge edgeToIndexOfPrevLevel.get(edge) = min {i: edge == tile.curveClips[i].edge}
    const dataByEntity = this.transferDataOfLevelToMap(levelToReduce)
    for (let k = 0; k < this.entsSortedByVisualAndPageRank.length; k++) {
      const e = this.entsSortedByVisualAndPageRank[k]
      if (!this.tryAddToLevel(levelToReduce, e, dataByEntity.get(e))) {
        console.log('added k', k, 'entities to level')
        return
      }
    }
  }

  /** goes over all tiles where 'ent' had a presence and tries to add the corresponding rendering data into it */
  tryAddToLevel(levelToReduce: IntPairMap<TileData>, ent: Entity, entityToData: EntityDataInTile[]) {
    for (const edt of entityToData) {
      const tile = edt.tile
      if (tile.elementCount >= this.tileCapacity) {
        return false
      }
    }
    for (const edt of entityToData) {
      const tile = edt.tile
      const data = edt.data
      tile.addElement(data)
    }
    return true
  }

  transferDataOfLevelToMap(levelToReduce: IntPairMap<TileData>): Map<Entity, EntityDataInTile[]> {
    const m = new Map<Entity, EntityDataInTile[]>()
    for (const v of levelToReduce.values()) {
      for (const cc of v.curveClips) {
        const edge = cc.edge
        const arr = getEntityDataArray(edge)
        arr.push({tile: v, data: cc})
      }
      for (const label of v.labels) {
        const edge = (label.parent as GeomEdge).edge
        const arr = getEntityDataArray(edge)
        arr.push({tile: v, data: label})
      }
      for (const gnode of v.nodes) {
        const node = gnode.node
        const arr = getEntityDataArray(node)
        arr.push({tile: v, data: gnode})
      }
      for (const arrowhead of v.arrowheads) {
        const edge = arrowhead.edge
        const arr = getEntityDataArray(edge)
        arr.push({tile: v, data: arrowhead})
      }
      v.clear()
    }

    return m

    function getEntityDataArray(ent: Entity) {
      let arr = m.get(ent)
      if (!arr) {
        m.set(ent, (arr = new Array<EntityDataInTile>()))
      }
      return arr
    }
  }
  private rankEntitiesOfThePreviousLevel(prevLevel: IntPairMap<TileData>) {
    return
    const edgeToIndexOfPrevLevel = new Map<Edge, number>()
    for (const tile of prevLevel.values()) {
      for (let i = 0; i < tile.curveClips.length; i++) {
        const e = tile.curveClips[i].edge
        const ii = edgeToIndexOfPrevLevel.get(e)
        if (ii != undefined) edgeToIndexOfPrevLevel.set(e, Math.min(i, ii))
      }
    }
    return
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
            if (allTilesAreSmall && tileData.elementCount > this.tileCapacityMin) {
              console.log(
                'found a tile at level',
                z,
                ' with ',
                tileData.elementCount,
                'elements, which is greater than',
                this.tileCapacityMin,
              )
              allTilesAreSmall = false
            }
          }
        }
    }
    if (allTilesAreSmall) {
      console.log('done at level', z, ' because each tile contains less than ', this.tileCapacityMin)
      return true
    }
    if (wz <= this.minTileSize.width && hz <= this.minTileSize.height) {
      console.log('done at level', z, ' because of the tile size = ', wz, hz, ' less than ', this.minTileSize)
      return true
    }
    return false
  }

  generateSubTile(upperTile: TileData, tileRect: Rectangle): TileData {
    if (upperTile.elementCount <= this.tileCapacityMin && false) {
      // just reuse the arrays from the upper tile
      return TileData.mk(upperTile.curveClips, upperTile.arrowheads, upperTile.nodes, upperTile.labels, tileRect)
    }
    const sd = TileData.mk([], [], [], [], tileRect)
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
