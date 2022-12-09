import {pageRank} from '../../structs/graph'
import {Rectangle} from '../../math/geometry/rectangle'
import {GeomNode} from './geomNode'
import {GeomEdge} from './geomEdge'
import {Edge} from '../../structs/edge'
import {IntPairMap} from '../../utils/IntPairMap'
import {clipWithRectangleInsideInterval} from '../../math/geometry/curve'
import {TileData, GeomGraph, tileIsEmpty} from './geomGraph'

/** keeps the data needed to render the tile hierarchy */
export class TileMap {
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
    // inject edges to curves
    for (const e of edges) {
      const c = GeomEdge.getGeom(e).curve
      // @ts-ignore
      c.edge = e
    }
    const curveClips = edges
      .map((e) => GeomEdge.getGeom(e).curve)
      .map((c) => {
        return {startPar: c.parStart, endPar: c.parEnd, curve: c}
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
    const data: TileData = {
      curveClips: curveClips,
      arrowheads: arrows,
      nodes: Array.from(rank.keys()).map((n) => GeomNode.getGeom(n)),
      labels: geomLabels,
      rect: this.topLevelTileRect,
    }
    tileMap.set(0, 0, data)
    this.dataArray.push(tileMap)
  }
  /** creates tilings for levels from 0 to z, including the level z
   */
  buildUpToLevel(z: number) {
    // the 0 level is filled in the constructor
    for (let i = 1; i <= z; i++) {
      this.subdivideToLevel(i)
    }
  }
  /** it is assumed that the previous levels have been calculated.
   * Returns true if every edge is appears in some tile as the first edge
   */
  private subdivideToLevel(z: number): boolean {
    const firstEdges = new Set<Edge>()
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
            if (tileData.curveClips.length > 0)
              // @ts-ignore
              firstEdges.add(tileData.curveClips[0].curve.edge)
          }
        }
    }
    const ret = this.edgeCount === firstEdges.size
    if (ret) {
      console.log('full at level', z)
    }
    return ret
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
        sd.curveClips.push({curve: clip.curve, startPar: newClip.start, endPar: newClip.end})
      }
    }
    for (const clip of sd.curveClips) {
      // @ts-ignore
      const geomEdge = GeomEdge.getGeom(clip.curve.edge as GeomEdge)
      if (geomEdge.sourceArrowhead && geomEdge.curve.parStart === clip.startPar)
        sd.arrowheads.push({tip: geomEdge.sourceArrowhead.tipPosition, edge: geomEdge.edge, base: geomEdge.curve.start})
      if (geomEdge.targetArrowhead && geomEdge.curve.parEnd === clip.endPar)
        sd.arrowheads.push({tip: geomEdge.targetArrowhead.tipPosition, edge: geomEdge.edge, base: geomEdge.curve.end})
    }
    if (!tileIsEmpty(sd)) {
      return sd
    }
  }
}
