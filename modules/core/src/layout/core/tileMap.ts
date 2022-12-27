import {pageRank} from '../../structs/graph'
import {Rectangle, Size} from '../../math/geometry/rectangle'
import {GeomNode} from './geomNode'
import {GeomEdge} from './geomEdge'
import {Edge} from '../../structs/edge'
import {IntPairMap} from '../../utils/IntPairMap'
import {Curve} from '../../math/geometry/curve'
import {GeomLabel} from './geomLabel'
import {Point} from '../../math/geometry/point'
import {GeomGraph} from '.'
import {GeomConstants, ICurve, LineSegment} from '../../math/geometry'
import {Entity} from '../../structs/entity'
import {TileData} from './tileData'
import {Node} from '../../structs/node'
import {IntPair} from '../../utils/IntPair'
/** Represents a part of the curve containing in a tile.
 * One tile can have several parts of clips corresponding to the same curve.
 */
export type CurveClip = {curve: ICurve; edge: Edge}
export type ArrowHeadData = {tip: Point; edge: Edge; base: Point}
type EntityDataInTile = {tile: TileData; data: CurveClip | ArrowHeadData | GeomLabel | GeomNode}
export function tileIsEmpty(sd: TileData): boolean {
  return sd.arrowheads.length === 0 && sd.curveClips.length === 0 && sd.nodes.length === 0
}

/** keeps the data needed to render the tile hierarchy */
export class TileMap {
  private visualRank = new Map<Entity, number>()
  /** stop generating new tiles when the tiles on the level has size that is less than minTileSize :
   * t.width <= this.minTileSize.width && t.height <= this.minTileSize.height
   */
  private minTileSize: Size
  /** the maximal number visual elements vizible in a tile */
  private tileCapacity = 10000
  /** the tiles of level z is represented by levels[z] */
  private levels: IntPairMap<TileData>[] = []

  private pageRank: Map<Entity, number>
  /** retrieves the data for a single tile(x-y-z) */
  getTileData(x: number, y: number, z: number): TileData {
    const mapOnLevel = this.levels[z]
    if (!mapOnLevel) return null
    return mapOnLevel.get(x, y)
  }
  /** retrieves all the tiles of z-th level */
  *getTilesOfLevel(z: number): IterableIterator<{x: number; y: number; data: TileData}> {
    const tm = this.levels[z]
    if (tm == null) return
    for (const [key, val] of tm.keyValues()) {
      yield {x: key.x, y: key.y, data: val}
    }
  }

  private geomGraph: GeomGraph
  private topLevelTileRect: Rectangle
  constructor(geomGraph: GeomGraph, topLevelTileRect: Rectangle) {
    this.geomGraph = geomGraph
    this.topLevelTileRect = topLevelTileRect
    this.fillTopLevelTile()
    this.minTileSize = this.getMinTileSize()
  }
  private getMinTileSize(): Size {
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
    return new Size(w * 8, h * 8)
  }

  private fillTopLevelTile() {
    const tileMap = new IntPairMap<TileData>(1)
    const rank = pageRank(this.geomGraph.graph, 0.85)
    this.pageRank = new Map<Edge, number>()
    for (const e of this.geomGraph.graph.deepEdges) {
      this.pageRank.set(e, rank.get(e.source) + rank.get(e.target))
      if (e.label) {
        this.pageRank.set(e.label, rank.get(e.source) + rank.get(e.target))
      }
    }
    for (const n of this.geomGraph.graph.nodesBreadthFirst) {
      const nodeRank = rank.get(n)
      this.pageRank.set(n, 2 * nodeRank) // to be comparable with the edges
    }

    const topLevelTile = new TileData()

    topLevelTile.curveClips = []

    const arrows = (topLevelTile.arrowheads = new Array<{tip: Point; edge: Edge; base: Point}>())
    const geomLabels = (topLevelTile.labels = new Array<GeomLabel>())
    for (const e of this.geomGraph.graph.deepEdges) {
      const geomEdge = GeomEdge.getGeom(e)
      const c = GeomEdge.getGeom(e).curve
      if (c instanceof Curve) {
        for (const seg of c.segs) {
          topLevelTile.curveClips.push({curve: seg, edge: e})
        }
      } else {
        topLevelTile.curveClips.push({curve: c, edge: e})
      }
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

    topLevelTile.nodes = Array.from(this.geomGraph.nodesBreadthFirst)
    topLevelTile.rect = this.topLevelTileRect

    tileMap.set(0, 0, topLevelTile)
    this.levels.push(tileMap)
  }
  /**
   * Creates tilings for levels from 0 to z, including the level z.
   * The method does not necesserely creates all levels until z, but can exit earlier
   *  if all tiles either has size smaller or equal than this.minTileSize or have at most this.tileCapacityMin elements.
   * Returns the number of created levels.
   */
  buildUpToLevel(z: number): number {
    let noNeedToSubdivide = true
    // level 0 is filled in the constructor: maybe it is small enough
    for (const tile of this.levels[0].values()) {
      if (tile.elementCount > this.tileCapacity) {
        noNeedToSubdivide = false
        break
      }
    }
    if (noNeedToSubdivide) return this.levels.length

    for (let i = 1; i <= z; i++) {
      if (this.subdivideLevel(i)) {
        break
      }
    }
    this.calculateVisualRank()
    this.pushUpNodeRanksAboveTheirEdges()
    const entsSortedByVisualAndPageRank = Array.from(this.visualRank.keys()).sort((u, v) => this.compareByVisPageRanks(u, v))
    // do not filter the lowest layer: it should show everything
    for (let i = 0; i < this.levels.length - 1; i++) {
      this.filterOutEntities(this.levels[i], entsSortedByVisualAndPageRank, i)
    }
    return this.levels.length
  }
  private pushUpNodeRanksAboveTheirEdges() {
    for (const n of this.geomGraph.nodesBreadthFirst) {
      if (n instanceof GeomGraph) continue
      let maxVisRank = this.visualRank.get(n.node)
      let maxPageRank = this.pageRank.get(n.node)
      let hasEdge = false
      for (const e of n.node.edges) {
        maxVisRank = Math.max(maxVisRank, this.visualRank.get(e))
        maxPageRank = Math.max(maxPageRank, this.pageRank.get(e))
        hasEdge = true
      }
      if (hasEdge) {
        this.visualRank.set(n.node, maxVisRank)
        this.pageRank.set(n.node, maxPageRank)
      } else {
        this.visualRank.set(n.node, 2 * maxVisRank)
        this.pageRank.set(n.node, 2 * maxPageRank)
      }
    }
  }
  private compareByVisPageRanks(u: Entity, v: Entity): number {
    const uVis = this.visualRank.get(u)
    const vVis = this.visualRank.get(v)
    if (uVis > vVis) {
      return -1
    }
    if (uVis < vVis) {
      return 1
    }
    const del = this.pageRank.get(v) - this.pageRank.get(u)
    if (del) return del
    // A Node has to be returned before any of its edges
    if (v instanceof Node && u instanceof Edge) {
      return 1
    }
    if (v instanceof Edge && u instanceof Node) {
      return -1
    }
    return 0
  }

  private calculateVisualRank() {
    for (const tile of this.levels[this.levels.length - 1].values()) {
      this.calculateVisualRankOnTile(tile)
    }
  }
  private calculateVisualRankOnTile(tile: TileData) {
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

  private filterOutEntities(levelToReduce: IntPairMap<TileData>, entsSortedByVisualAndPageRank: Entity[], z: number) {
    // create a map,edgeToIndexOfPrevLevel, from the prevLevel edges to integers,
    // For each edge edgeToIndexOfPrevLevel.get(edge) = min {i: edge == tile.curveClips[i].edge}
    const dataByEntity = this.transferDataOfLevelToMap(levelToReduce)
    let k = 0
    for (; k < entsSortedByVisualAndPageRank.length; k++) {
      const e = entsSortedByVisualAndPageRank[k]
      if (!this.tryAddToLevel(levelToReduce, e, dataByEntity.get(e))) {
        break
      }
    }
    console.log('added', k, 'visual elements to level', z)
  }

  /** goes over all tiles where 'ent' had a presence and tries to add the corresponding rendering data into it */
  private tryAddToLevel(levelToReduce: IntPairMap<TileData>, ent: Entity, entityToData: EntityDataInTile[], force = false) {
    if (!force) {
      for (const edt of entityToData) {
        const tile = edt.tile
        if (tile.elementCount >= this.tileCapacity) {
          return false
        }
      }
    }
    for (const edt of entityToData) {
      const tile = edt.tile
      const data = edt.data
      tile.addElement(data)
    }
    return true
  }

  private transferDataOfLevelToMap(levelToReduce: IntPairMap<TileData>): Map<Entity, EntityDataInTile[]> {
    const m = new Map<Entity, EntityDataInTile[]>()
    for (const tile of levelToReduce.values()) {
      for (const cc of tile.curveClips) {
        const edge = cc.edge
        const arr = getEntityDataArray(edge)
        arr.push({tile: tile, data: cc})
      }
      for (const label of tile.labels) {
        const edge = (label.parent as GeomEdge).edge
        const arr = getEntityDataArray(edge)
        arr.push({tile: tile, data: label})
      }
      for (const gnode of tile.nodes) {
        const node = gnode.node
        const arr = getEntityDataArray(node)
        arr.push({tile: tile, data: gnode})
      }
      for (const arrowhead of tile.arrowheads) {
        const edge = arrowhead.edge
        const arr = getEntityDataArray(edge)
        arr.push({tile: tile, data: arrowhead})
      }
      tile.clear()
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

  /** It is assumed that the previous level z-1 have been calculated.
   * Returns true if every edge is appears in some tile as the first edge
   */

  private subdivideLevel(z: number): boolean {
    const tilesInRow = Math.pow(2, z)
    const levelTiles = (this.levels[z] = new IntPairMap<TileData>(tilesInRow))
    /** the width and the height of z-th level tile */
    let w = this.topLevelTileRect.width
    let h = this.topLevelTileRect.height
    for (let i = 0; i < z; i++) {
      w /= 2
      h /= 2
    }
    const allTilesAreSmall = this.subdivideTilesOnLevel(z, w, h, levelTiles)
    if (allTilesAreSmall) {
      console.log('done at level', z, ' because each tile contains less than ', this.tileCapacity)
      return true
    }
    if (w <= this.minTileSize.width && h <= this.minTileSize.height) {
      console.log('done at level', z, ' because of the tile size = ', w, h, ' less than ', this.minTileSize)
      return true
    }
    return false
  }

  private subdivideTilesOnLevel(z: number, w: number, h: number, levelTiles: IntPairMap<TileData>) {
    let allTilesAreSmall = true

    for (const [key, tile] of this.levels[z - 1].keyValues()) {
      allTilesAreSmall = this.subdivideOneTile(key, w, h, tile, levelTiles, allTilesAreSmall, z)
    }
    return allTilesAreSmall
  }

  private subdivideOneTile(
    key: IntPair,
    /** new tile width */
    w: number,
    /** new tile height */
    h: number,

    /** this is the tile we are subdividing */
    upperTile: TileData,
    /** this is the map we collect new tiles to */
    levelTiles: IntPairMap<TileData>,
    allTilesAreSmall: boolean,
    z: number,
  ) {
    const xp = key.x
    const yp = key.y
    const left = this.topLevelTileRect.left + xp * w * 2
    const bottom = this.topLevelTileRect.bottom + yp * h * 2
    const tdArr = new Array<TileData>(4)

    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const tileRect = new Rectangle({
          left: left + w * i,
          right: left + w * (i + 1),
          bottom: bottom + h * j,
          top: bottom + h * (j + 1),
        })
        tdArr[i * 2 + j] = this.generateSubTileWithoutEdgeClips(upperTile, tileRect)
      }

    cycleOverAllCurveClips()
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const tile = tdArr[i * 2 + j]

        if (!tile.isEmpty()) {
          levelTiles.set(2 * xp + i, 2 * yp + j, tile)
          if (allTilesAreSmall && tile.elementCount > this.tileCapacity) {
            console.log('found a tile at level', z, ' with ', tile.elementCount, 'elements, which is greater than', this.tileCapacity)
            allTilesAreSmall = false
          }
        }
      }
    return allTilesAreSmall

    function cycleOverAllCurveClips() {
      const horizontalMiddleLine = new LineSegment(left, bottom + h, left + 2 * w, bottom + h)
      const verticalMiddleLine = new LineSegment(left + w, bottom, left + w, bottom + 2 * h)
      for (const cs of upperTile.curveClips) {
        // Assert.assert(upperTile.rect.containsRect(cs.curve.boundingBox))
        const xs = Array.from(Curve.getAllIntersections(cs.curve, horizontalMiddleLine, false)).concat(
          Array.from(Curve.getAllIntersections(cs.curve, verticalMiddleLine, false)),
        )
        xs.sort((a, b) => a.par0 - b.par0)
        const filteredXs = [cs.curve.parStart]
        for (let i = 0; i < xs.length; i++) {
          const ii = xs[i]
          if (ii.par0 > filteredXs[filteredXs.length - 1] + GeomConstants.distanceEpsilon) {
            filteredXs.push(ii.par0)
          }
        }
        if (cs.curve.parEnd > filteredXs[filteredXs.length - 1] + GeomConstants.distanceEpsilon) {
          filteredXs.push(cs.curve.parEnd)
        }
        for (let u = 0; u < filteredXs.length - 1; u++) {
          const tr = filteredXs.length > 2 ? cs.curve.trim(filteredXs[u], filteredXs[u + 1]) : cs.curve
          if (!tr) continue // could no trim!
          const del = (tr.parEnd - tr.parStart) / 5

          let t = tr.parStart
          const trBb = tr.boundingBox
          for (let r = 0; r < 6; r++, t += del) {
            const p = tr.value(t)
            const i = p.x <= left + w ? 0 : 1
            const j = p.y <= bottom + h ? 0 : 1
            const k = 2 * i + j
            const tile = tdArr[k]

            if (!tile.rect.containsRect(trBb)) continue
            //   Assert.assert(tile.rect.contains(p))
            tile.curveClips.push({curve: tr, edge: cs.edge})
            break
          }
        }
      }
    }
  }

  private generateSubTileWithoutEdgeClips(upperTile: TileData, tileRect: Rectangle): TileData {
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

    for (const arrowhead of upperTile.arrowheads) {
      const arrowheadBox = Rectangle.mkPP(arrowhead.base, arrowhead.tip)
      const d = arrowhead.tip.sub(arrowhead.base).div(3)
      const dRotated = d.rotate90Cw()
      arrowheadBox.add(arrowhead.base.add(dRotated))
      arrowheadBox.add(arrowhead.base.sub(dRotated))
      if (arrowheadBox.intersects(tileRect)) sd.arrowheads.push(arrowhead)
    }
    return sd
  }
}
