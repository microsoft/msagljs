import {edgeNodesBelongToSet, pagerank} from '../../structs/graph'
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
import {Tile} from './tile'
import {Node} from '../../structs/node'
import {IntPair} from '../../utils/IntPair'
import {SplineRouter} from '../../routing/splineRouter'
/** Represents a part of the curve containing in a tile.
 * One tile can have several parts of clips corresponding to the same curve.
 */
export type CurveClip = {curve: ICurve; edge: Edge}
export type ArrowHeadData = {tip: Point; edge: Edge; base: Point}
type EntityDataInTile = {tile: Tile; data: CurveClip | ArrowHeadData | GeomLabel | GeomNode}
export function tileIsEmpty(sd: Tile): boolean {
  return sd.arrowheads.length === 0 && sd.curveClips.length === 0 && sd.nodes.length === 0
}
// let debCount = 0
/** keeps the data needed to render the tile hierarchy */
export class TileMap {
  /** stop generating new tiles when the tiles on the level has size that is less than minTileSize :
   * t.width <= this.minTileSize.width && t.height <= this.minTileSize.height
   */
  private minTileSize: Size
  /** the maximal number visual elements vizible in a tile */
  private tileCapacity = 1000 // in the number of elements
  /** the tiles of level z is represented by levels[z] */
  private levels: IntPairMap<Tile>[] = []

  private pageRank: Map<Node, number>

  /** the more rank is the more important the entity is */
  nodeRank: Map<Node, number>
  nodeIndexInSortedNodes: Map<Node, number> = new Map<Node, number>()
  tileSizes: Size[]

  /** retrieves the data for a single tile(x-y-z) */
  getTileData(x: number, y: number, z: number): Tile {
    const mapOnLevel = this.levels[z]
    if (!mapOnLevel) return null
    return mapOnLevel.get(x, y)
  }
  /** retrieves all the tiles of z-th level */
  *getTilesOfLevel(z: number): IterableIterator<{x: number; y: number; data: Tile}> {
    const tm = this.levels[z]
    if (tm == null) return
    for (const [key, val] of tm.keyValues()) {
      yield {x: key.x, y: key.y, data: val}
    }
  }

  private geomGraph: GeomGraph
  private topLevelTileRect: Rectangle
  /** geomGraph  - the graph to work with.
   * The topLevelTileRect serves as the only tile of the top level.
   */
  constructor(geomGraph: GeomGraph, topLevelTileRect: Rectangle) {
    this.geomGraph = geomGraph
    this.topLevelTileRect = topLevelTileRect
    this.tileSizes = []
    this.tileSizes.push(topLevelTileRect.size)
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
    return new Size(w * 3, h * 3)
  }

  private fillTheLowestLayer() {
    const tileMap = new IntPairMap<Tile>(1)
    const topLevelTile = new Tile()

    topLevelTile.curveClips = []

    const arrows = (topLevelTile.arrowheads = new Array<{tip: Point; edge: Edge; base: Point}>())
    const geomLabels = (topLevelTile.labels = new Array<GeomLabel>())
    for (const e of this.geomGraph.graph.deepEdges) {
      const geomEdge = GeomEdge.getGeom(e)
      const c = GeomEdge.getGeom(e).curve
      pushToClips(topLevelTile.curveClips, e, c)
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
    this.fillTheLowestLayer()
    this.minTileSize = this.getMinTileSize()
    this.pageRank = pagerank(this.geomGraph.graph, 0.85)

    let needSubdivide = false
    for (const tile of this.levels[0].values()) {
      if (tile.entityCount > this.tileCapacity) {
        needSubdivide = true
        break
      }
    }
    if (!needSubdivide) return 1 // we have only one layer

    for (let i = 1; i <= z; i++) {
      if (this.subdivideLevel(i)) {
        break
      }
    }
    const sortedNodes = Array.from(this.pageRank.keys()).sort(this.compareByPagerank.bind(this))
    for (let i = 0; i < sortedNodes.length; i++) {
      this.nodeIndexInSortedNodes.set(sortedNodes[i], i)
    }

    const numberOfNodesInLayer = []
    // do not filter the uppermost layer: it should show everything
    for (let i = 0; i < this.levels.length - 1; i++) {
      numberOfNodesInLayer.push(this.filterOutEntities(this.levels[i], sortedNodes, i))
    }
    // for (let i = 0; i < this.levels.length; i++) {
    //   this.checkLevel(i)
    // }
    const sr = new SplineRouter(this.geomGraph, [])

    for (let i = this.levels.length - 2; i >= 0; i--) {
      const activeNodes = new Set<Node>(sortedNodes.slice(0, numberOfNodesInLayer[i]))
      sr.rerouteOnSubsetOfNodes(activeNodes)
      this.regenerateCurveClipsUpToLayer(i, activeNodes)
    }

    // for (let i = 0; i < this.levels.length; i++) {
    //   this.checkLevel(i)
    // }
    this.calculateNodeRank(sortedNodes)
    //Assert.assert(this.lastLayerHasAllNodes())
    return this.levels.length
  }
  // checkLevel(i: number) {
  //   const [edgeMap, nodeSet] = this.getEntityDataFromLevel(i)
  //   for (const [e, entDataArray] of edgeMap) {
  //     this.checkEntityDataArray(e, entDataArray, nodeSet)
  //   }
  // }
  // checkEntityDataArray(e: Entity, entDataArray: EntityDataInTile[], nodeSet: Set<Node>) {
  //   if (e instanceof Edge) {

  //     if (!nodeSet.has(e.source)) {
  //       Assert.assert(false)
  //     }
  //     if (!nodeSet.has(e.target)) {
  //       Assert.assert(false)
  //     }
  //     let connectedToSource = false
  //     let connectedToTarget = false
  //     const ge = GeomEdge.getGeom(e)
  //     const sb = ge.source.boundingBox
  //     const tb = ge.target.boundingBox
  //     for (const cc of entDataArray) {
  //       if ('curve' in cc.data) {
  //         Assert.assert(cc.data.edge === e)
  //         const curve = cc.data.curve
  //         if (sb.contains(curve.start)) connectedToSource = true
  //         if (tb.contains(curve.end)) connectedToTarget = true
  //       }
  //     }
  //     Assert.assert(connectedToSource && connectedToTarget)
  //   }
  // }
  getEntityDataFromLevel(i: number): [Map<Entity, EntityDataInTile[]>, Set<Node>] {
    const m = new Map<Entity, EntityDataInTile[]>()
    const nodeSet = new Set<Node>()
    for (const t of this.levels[i].values()) {
      for (const cc of t.curveClips) {
        const e = cc.edge
        let arr: EntityDataInTile[] = m.get(e)
        if (arr == null) {
          m.set(e, (arr = []))
        }
        arr.push({data: cc, tile: t})
      }
      for (const n of t.nodes) {
        nodeSet.add(n.node)
      }
    }
    return [m, nodeSet]
  }
  regenerateCurveClipsUpToLayer(levelIndex: number, activeNodes: Set<Node>) {
    this.clearCurveClipsInLevelsUpTo(levelIndex)
    for (const t of this.levels[0].values()) {
      this.regenerateCurveClipsUnderTileUpToLevel(t, levelIndex, activeNodes)
    }
  }
  private clearCurveClipsInLevelsUpTo(levelIndex: number) {
    for (let i = 0; i <= levelIndex; i++) {
      for (const t of this.levels[i].values()) {
        t.curveClips = []
      }
    }
  }

  regenerateCurveClipsUnderTileUpToLevel(t: Tile, levelIndex: number, activeNodes: Set<Node>) {
    t.arrowheads = []
    t.curveClips = []
    for (const geomEdge of this.geomGraph.deepEdges) {
      if (!edgeNodesBelongToSet(geomEdge.edge, activeNodes)) continue
      pushToClips(t.curveClips, geomEdge.edge, geomEdge.curve)
      if (geomEdge.sourceArrowhead) {
        t.arrowheads.push({edge: geomEdge.edge, tip: geomEdge.sourceArrowhead.tipPosition, base: geomEdge.curve.start})
      }
      if (geomEdge.targetArrowhead) {
        t.arrowheads.push({edge: geomEdge.edge, tip: geomEdge.targetArrowhead.tipPosition, base: geomEdge.curve.end})
      }
    }
    // do not change the labels
    // Now the top tile(s) is ready
    for (let i = 1; i <= levelIndex; i++) {
      this.regenerateCurveClipsWhenPreviosLayerIsDone(i)
      this.removeEmptyTiles(i)
    }
  }
  private removeEmptyTiles(i: number) {
    const level = this.levels[i]
    const keysToDelete = []
    for (const [k, t] of level.keyValues()) {
      if (t.isEmpty()) {
        keysToDelete.push(k)
      }
    }
    for (const k of keysToDelete) {
      level.delete(k.x, k.y)
    }
  }

  regenerateCurveClipsWhenPreviosLayerIsDone(z: number) {
    for (const [key, tile] of this.levels[z - 1].keyValues()) {
      this.regenerateUnderOneTile(key, tile, z)
    }
  }
  regenerateUnderOneTile(key: IntPair, upperTile: Tile, z: number) {
    const subTilesRects = createSubTileRects()
    const clipsPerRect = this.regenerateCurveClipsUnderTile(upperTile, subTilesRects)
    pushRegeneratedClips(this.levels[z])

    cleanArrowheadsInSubtiles(this.levels[z])

    pushArrowheadsToSubtiles()

    cleanUpSubtilesUnderTile(this.levels[z])
    function cleanUpSubtilesUnderTile(thislevels: IntPairMap<Tile>) {
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const ti = 2 * key.x + i
          const tj = 2 * key.y + j
          const tile = thislevels.get(ti, tj)
          if (tile == null) continue
          if (tile.isEmpty()) {
            thislevels.delete(ti, tj)
          }
        }
    }

    function pushArrowheadsToSubtiles() {
      for (const arrowhead of upperTile.arrowheads) {
        const arrowheadBox = Rectangle.mkPP(arrowhead.base, arrowhead.tip)
        const d = arrowhead.tip.sub(arrowhead.base).div(3)
        const dRotated = d.rotate90Cw()
        arrowheadBox.add(arrowhead.base.add(dRotated))
        arrowheadBox.add(arrowhead.base.sub(dRotated))
        for (let i = 0; i < 2; i++)
          for (let j = 0; j < 2; j++) {
            const k = 2 * i + j
            if (arrowheadBox.intersects(subTilesRects[k])) {
              const ti = 2 * key.x + i
              const tj = 2 * key.y + j

              this.levels[z].get(ti, tj).arrowheads.push(arrowhead)
            }
          }
      }
    }

    function cleanArrowheadsInSubtiles(levelMap: IntPairMap<Tile>) {
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const ti = 2 * key.x + i
          const tj = 2 * key.y + j
          const tile = levelMap.get(ti, tj)
          if (tile == null) {
            continue
          }
          tile.arrowheads = []
        }
    }

    function pushRegeneratedClips(levelMap: IntPairMap<Tile>) {
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const k = 2 * i + j
          const clips = clipsPerRect[k]

          const ti = 2 * key.x + i
          const tj = 2 * key.y + j
          let tile = levelMap.get(ti, tj)
          if (tile == null) {
            if (clips.length) {
              levelMap.set(ti, tj, (tile = Tile.mk([], [], [], [], subTilesRects[k])))
            } else {
              continue
            }
          }
          tile.curveClips = []
          for (const clip of clips) {
            pushToClips(tile.curveClips, clip.edge, clip.curve)
          }
        }
    }

    function createSubTileRects() {
      const subTilesRects = new Array<Rectangle>()
      const w = upperTile.rect.width / 2
      const h = upperTile.rect.height / 2
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const tileRect = new Rectangle({
            left: upperTile.rect.left + w * i,
            right: upperTile.rect.left + w * (i + 1),
            bottom: upperTile.rect.bottom + h * j,
            top: upperTile.rect.bottom + h * (j + 1),
          })
          subTilesRects.push(tileRect)
        }
      return subTilesRects
    }
  }

  regenerateCurveClipsUnderTile(upperTile: Tile, subTilesRects: Rectangle[]): Array<Array<CurveClip>> {
    const ret = new Array<Array<CurveClip>>() // form the 2x2 matrix
    for (let i = 0; i < 4; i++) {
      ret.push([])
    }
    const w = subTilesRects[0].width
    const h = subTilesRects[0].height
    const horizontalMiddleLine = new LineSegment(
      upperTile.rect.left,
      upperTile.rect.bottom + h,
      upperTile.rect.right,
      upperTile.rect.bottom + h,
    )
    const verticalMiddleLine = new LineSegment(upperTile.rect.left + w, upperTile.rect.bottom, upperTile.rect.left + w, upperTile.rect.top)
    for (const cs of upperTile.curveClips) {
      for (const tr of this.innerClips(cs.curve, verticalMiddleLine, horizontalMiddleLine)) {
        const del = (tr.parEnd - tr.parStart) / 5

        let t = tr.parStart
        const trBb = tr.boundingBox
        for (let r = 0; r < 6; r++, t += del) {
          const p = tr.value(t)
          const i = p.x <= upperTile.rect.left + w ? 0 : 1
          const j = p.y <= upperTile.rect.bottom + h ? 0 : 1
          const k = 2 * i + j
          const rect = subTilesRects[k]

          if (rect.containsRect(trBb)) {
            //   Assert.assert(tile.rect.contains(p))
            ret[k].push({curve: tr, edge: cs.edge})
            // Assert.assert(this.clipIsLegal(tr, cs.edge, rect, horizontalMiddleLine, verticalMiddleLine, upperTile))
            break
          }
        }
      }
    }
    return ret
  }

  // lastLayerHasAllNodes(): boolean {
  //   const lastLayerNodes = new Set<Node>()
  //   for (const tile of this.levels[this.levels.length - 1].values()) {
  //     for (const n of tile.nodes) {
  //       lastLayerNodes.add(n.node)
  //     }
  //   }
  //   const gNodes = new Set<Node>(this.geomGraph.graph.nodesBreadthFirst)
  //   return setsAreEqual(gNodes, lastLayerNodes)
  // }
  private calculateNodeRank(sortedNodes: Node[]) {
    this.nodeRank = new Map<Node, number>()
    const n = sortedNodes.length
    for (let i = 0; i < n; i++) {
      this.nodeRank.set(sortedNodes[i], -Math.log10((i + 1) / n))
    }
  }
  private compareByPagerank(u: Node, v: Node): number {
    return this.pageRank.get(v) - this.pageRank.get(u)
  }

  /** Fills the tiles up to the capacity.
   * Returns the number of inserted node.
   * An edge and its attributes is inserted just after its source and the target are inserted.
   * The nodes are sorted by rank here.  */

  private filterOutEntities(levelToReduce: IntPairMap<Tile>, nodes: Node[], z: number) {
    // create a map,edgeToIndexOfPrevLevel, from the prevLevel edges to integers,
    // For each edge edgeToIndexOfPrevLevel.get(edge) = min {i: edge == tile.curveClips[i].edge}
    const dataByEntityMap = this.transferDataOfLevelToMap(levelToReduce)
    let k = 0
    for (; k < nodes.length; k++) {
      const n = nodes[k]
      if (!this.addNodeToLevel(levelToReduce, n, dataByEntityMap)) {
        break
      }
    }
    this.removeEmptyTiles(z)

    let totalCount = 0
    for (const t of levelToReduce.keyValues()) {
      totalCount += t[1].entityCount
    }
    console.log('added', k, 'nodes to level', z, ', in total', totalCount, 'elements')
    return k
  }

  /** Goes over all tiles where 'node' had presence and tries to add.
   *  If the above succeeds then all edges leading to the higher ranking nodes added without consulting with tileCapacity. The edge attributes added as well
   */
  private addNodeToLevel(levelToReduce: IntPairMap<Tile>, node: Node, dataByEntity: Map<Entity, EntityDataInTile[]>) {
    const entityToData = dataByEntity.get(node)
    for (const edt of entityToData) {
      const tile = edt.tile
      if (tile.entityCount >= this.tileCapacity) {
        return false
      }
    }

    for (const edt of entityToData) {
      const tile = edt.tile
      const data = edt.data
      tile.addElement(data)
    }

    for (const e of node.selfEdges) {
      const ed = dataByEntity.get(e)
      for (const edt of ed) {
        const tile = edt.tile
        const data = edt.data
        tile.addElement(data)
      }
      if (e.label) {
        for (const edt of dataByEntity.get(e.label)) {
          const tile = edt.tile
          const data = edt.data
          tile.addElement(data)
        }
      }
    }
    const nodeIndex = this.nodeIndexInSortedNodes.get(node)
    for (const e of node.inEdges) {
      const source = e.source
      const sourceIndex = this.nodeIndexInSortedNodes.get(source)
      if (sourceIndex > nodeIndex) continue
      for (const edt of dataByEntity.get(e)) {
        const tile = edt.tile
        const data = edt.data
        tile.addElement(data)
      }
      if (e.label) {
        for (const edt of dataByEntity.get(e.label)) {
          const tile = edt.tile
          const data = edt.data
          tile.addElement(data)
        }
      }
    }
    for (const e of node.outEdges) {
      const target = e.target
      const targetIndex = this.nodeIndexInSortedNodes.get(target)
      if (targetIndex > nodeIndex) continue
      for (const edt of dataByEntity.get(e)) {
        const tile = edt.tile
        const data = edt.data
        tile.addElement(data)
      }
      if (e.label) {
        for (const edt of dataByEntity.get(e.label)) {
          const tile = edt.tile
          const data = edt.data
          tile.addElement(data)
        }
      }
    }

    return true
  }

  private transferDataOfLevelToMap(levelToReduce: IntPairMap<Tile>): Map<Entity, EntityDataInTile[]> {
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
    const levelTiles = (this.levels[z] = new IntPairMap<Tile>(tilesInRow))
    /** the width and the height of z-th level tile */
    const {w, h} = this.getWHOnLevel(z)
    const allTilesAreSmall = this.subdivideTilesOnLevel(z, w, h, levelTiles)
    if (allTilesAreSmall) {
      console.log('done subdividing at level', z, ' because each tile contains less than ', this.tileCapacity)
      return true
    }
    if (w <= this.minTileSize.width && h <= this.minTileSize.height) {
      console.log('done subdividing at level', z, ' because of the tile size = ', w, h, ' less than ', this.minTileSize)
      return true
    }
    return false
  }

  private getWHOnLevel(z: number) {
    for (let i = this.tileSizes.length; i <= z; i++) {
      const s = this.tileSizes[i - 1]
      this.tileSizes.push(new Size(s.width / 2, s.height / 2))
    }
    return {w: this.tileSizes[z].width, h: this.tileSizes[z].height}
  }

  private subdivideTilesOnLevel(z: number, w: number, h: number, levelTiles: IntPairMap<Tile>) {
    let allTilesAreSmall = true

    for (const [key, tile] of this.levels[z - 1].keyValues()) {
      const tileIsSmall = this.subdivideOneTile(key, w, h, tile, levelTiles)
      if (allTilesAreSmall) {
        allTilesAreSmall = tileIsSmall
      }
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
    upperTile: Tile,
    /** this is the map we collect new tiles to */
    levelTiles: IntPairMap<Tile>,
  ) {
    let allTilesAreSmall = true
    const xp = key.x
    const yp = key.y
    const left = this.topLevelTileRect.left + xp * w * 2
    const bottom = this.topLevelTileRect.bottom + yp * h * 2
    const tdArr = new Array<Tile>(4)

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
          if (allTilesAreSmall && tile.entityCount > this.tileCapacity) {
            //console.log('found a tile at level', z, ' with ', tile.elementCount, 'elements, which is greater than', this.tileCapacity)
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
        const xs = Array.from(Curve.getAllIntersections(cs.curve, horizontalMiddleLine, true)).concat(
          Array.from(Curve.getAllIntersections(cs.curve, verticalMiddleLine, true)),
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

            if (tile.rect.containsRect(trBb)) {
              //   Assert.assert(tile.rect.contains(p))
              pushToClips(tile.curveClips, cs.edge, tr)
              break
            }
          }
        }
      }
    }
  }

  innerClips(curve: ICurve, verticalMiddleLine: LineSegment, horizontalMiddleLine: LineSegment): Array<ICurve> {
    //debCount++
    const ret = []
    // Assert.assert(upperTile.rect.containsRect(cs.curve.boundingBox))
    const xs = Array.from(Curve.getAllIntersections(curve, horizontalMiddleLine, true)).concat(
      Array.from(Curve.getAllIntersections(curve, verticalMiddleLine, true)),
    )
    xs.sort((a, b) => a.par0 - b.par0)
    const filteredXs = [curve.parStart]
    for (let i = 0; i < xs.length; i++) {
      const ii = xs[i]
      if (ii.par0 > filteredXs[filteredXs.length - 1] + GeomConstants.distanceEpsilon) {
        filteredXs.push(ii.par0)
      }
    }
    if (curve.parEnd > filteredXs[filteredXs.length - 1] + GeomConstants.distanceEpsilon) {
      filteredXs.push(curve.parEnd)
    }

    if (filteredXs.length <= 2) {
      ret.push(curve)
      return ret
    }
    for (let u = 0; u < filteredXs.length - 1; u++) {
      ret.push(curve.trim(filteredXs[u], filteredXs[u + 1]))
    }

    // if (debCount == 3) {
    //   console.log(ret)
    //   const trs = []
    //   for (let i = 0; i < ret.length; i++) {
    //     trs.push(DebugCurve.mkDebugCurveWCI(i + 1, 'Black', ret[i]))
    //   }
    //   SvgDebugWriter.dumpDebugCurves(
    //     './tmp/innerClips.svg',
    //     [
    //       DebugCurve.mkDebugCurveTWCI(150, 2, 'Yellow', verticalMiddleLine),
    //       DebugCurve.mkDebugCurveTWCI(100, 2, 'Magenta', horizontalMiddleLine),
    //       DebugCurve.mkDebugCurveTWCI(100, 5, 'Blue', curve),
    //     ].concat(trs),
    //   )
    // }

    return ret
  }

  private generateSubTileWithoutEdgeClips(upperTile: Tile, tileRect: Rectangle): Tile {
    const tile = Tile.mk([], [], [], [], tileRect)
    for (const n of upperTile.nodes) {
      if (n.boundingBox.intersects(tileRect)) {
        tile.nodes.push(n)
      }
    }

    for (const lab of upperTile.labels) {
      if (lab.boundingBox.intersects(tileRect)) {
        tile.labels.push(lab)
      }
    }

    for (const arrowhead of upperTile.arrowheads) {
      const arrowheadBox = Rectangle.mkPP(arrowhead.base, arrowhead.tip)
      const d = arrowhead.tip.sub(arrowhead.base).div(3)
      const dRotated = d.rotate90Cw()
      arrowheadBox.add(arrowhead.base.add(dRotated))
      arrowheadBox.add(arrowhead.base.sub(dRotated))
      if (arrowheadBox.intersects(tileRect)) tile.arrowheads.push(arrowhead)
    }
    return tile
  }
  // clipIsLegal(
  //   tr: ICurve,
  //   edge: Edge,
  //   rect: Rectangle,
  //   horizontalMiddleLine: LineSegment,
  //   verticalMiddleLine: LineSegment,
  //   upperTile: Tile,
  // ): boolean {
  //   if (!rect.contains(tr.start)) return false
  //   if (!rect.contains(tr.end)) return false
  //   if (rect.contains_point_radius(tr.start, -0.1)) {
  //     if (!GeomNode.getGeom(edge.source).boundingBox.intersects(rect)) {
  //       //   SvgDebugWriter.dumpDebugCurves('./tmp/bug.svg', [
  //       //     DebugCurve.mkDebugCurveCI('Black', rect.perimeter()),
  //       //     DebugCurve.mkDebugCurveCI('Red', GeomNode.getGeom(edge.source).boundaryCurve),
  //       //     DebugCurve.mkDebugCurveCI('Blue', GeomNode.getGeom(edge.target).boundaryCurve),
  //       //     DebugCurve.mkDebugCurveTWCI(100, 0.5, 'Green', GeomEdge.getGeom(edge).curve),
  //       //     DebugCurve.mkDebugCurveTWCI(100, 2, 'Brown', tr),
  //       //   ])
  //       return false
  //     }
  //   }
  //   if (rect.contains_point_radius(tr.end, -0.1)) {
  //     if (!GeomNode.getGeom(edge.target).boundingBox.intersects(rect)) {
  //       // SvgDebugWriter.dumpDebugCurves('./tmp/bug.svg', [
  //       //   DebugCurve.mkDebugCurveCI('Black', rect.perimeter()),
  //       //   DebugCurve.mkDebugCurveCI('Red', GeomNode.getGeom(edge.source).boundaryCurve),
  //       //   DebugCurve.mkDebugCurveCI('Blue', GeomNode.getGeom(edge.target).boundaryCurve),
  //       //   DebugCurve.mkDebugCurveTWCI(100, 0.5, 'Green', GeomEdge.getGeom(edge).curve),
  //       //   DebugCurve.mkDebugCurveTWCI(100, 2, 'Brown', tr),
  //       //   DebugCurve.mkDebugCurveTWCI(100, 2, 'Yellow', verticalMiddleLine),
  //       //   DebugCurve.mkDebugCurveTWCI(100, 2, 'Magenta', horizontalMiddleLine),
  //       //   DebugCurve.mkDebugCurveTWCI(100, 2, 'Blue', upperTile.rect.perimeter()),
  //       // ])
  //       return false
  //     }
  //   }
  //   return true
  // }
}
function pushToClips(clips: CurveClip[], e: Edge, c: ICurve) {
  if (c instanceof Curve) {
    for (const seg of c.segs) {
      clips.push({curve: seg, edge: e})
    }
  } else {
    clips.push({curve: c, edge: e})
  }
}
