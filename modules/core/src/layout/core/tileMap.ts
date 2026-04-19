import {edgeNodesBelongToSet, pagerank} from '../../structs/graph'
import {Rectangle, Size} from '../../math/geometry/rectangle'
import {GeomNode} from './geomNode'
import {GeomEdge} from './geomEdge'
import {Edge} from '../../structs/edge'
import {IntPairMap} from '../../utils/IntPairMap'
import {Curve, clipWithRectangle} from '../../math/geometry/curve'
import {GeomLabel} from './geomLabel'
import {Point} from '../../math/geometry/point'
import {GeomGraph} from './geomGraph'
import {GeomConstants, ICurve, LineSegment} from '../../math/geometry'
import {Entity} from '../../structs/entity'
import {Tile} from './tile'
import {Node} from '../../structs/node'
import {IntPair} from '../../utils/IntPair'
import {SplineRouter} from '../../routing/splineRouter'
import {routeCorridorEdges} from '../../routing/corridorRouter'
import {EdgeRoutingMode} from '../../routing/EdgeRoutingMode'
import {getEdgeRoutingSettingsFromAncestorsOrDefault} from '../driver'
import {Assert} from '../../utils/assert'
//import {RTree} from 'hilbert-rtree/build'

/** Represents a part of the curve containing in a tile.
 * The tile part of the curve is defined by the startPar and endPar.
 * One tile can have several parts of clips corresponding to the same curve.
 */
export type CurveClip = {curve: ICurve; edge?: Edge; startPar: number; endPar: number}
export type ArrowHeadData = {tip: Point; edge: Edge; base: Point}
type EntityDataInTile = {tile: Tile; data: CurveClip | ArrowHeadData | GeomLabel | GeomNode}

//const debCount = 0
/** keeps the data needed to render the tile hierarchy */
export class TileMap {
  sortedNodes: Node[]
  numberOfNodesOnLevel: number[] = []
  /** Per-level map from Node to display scale factor (finest level = 1). */
  nodeScales: Map<Node, number>[] = []
  /** stop generating new tiles when the tiles on the level has size that is less than minTileSize :
   * t.width <= this.minTileSize.width && t.height <= this.minTileSize.height
   */
  private minTileSize: Size
  /** the maximal number visual elements vizible in a tile */
  private tileCapacity = 500 // in the number of elements
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

  /** Returns the display scale for the given node at the given level index.
   *  1 if not tracked (e.g. spline-routed graphs). */
  getNodeScale(node: Node, levelIndex: number): number {
    const m = this.nodeScales[levelIndex]
    if (!m) return 1
    const s = m.get(node)
    return s == null ? 1 : s
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
    return new Size(w * 10, h * 10)
  }

  private fillTheLowestLayer() {
    const tileMap = new IntPairMap<Tile>()
    const topLevelTile = new Tile(this.topLevelTileRect)

    const arrows = topLevelTile.arrowheads
    const geomLabels = topLevelTile.labels
    for (const e of this.geomGraph.graph.deepEdges) {
      addEdgeToTiles(e)
    }
    // geomLabels and arrowheads are sorted, because edges are sorted: all arrays of TileData are sorted by rank
    topLevelTile.nodes = Array.from(this.geomGraph.nodesBreadthFirst)
    tileMap.set(0, 0, topLevelTile)
    this.levels.push(tileMap)

    function addEdgeToTiles(e: Edge) {
      const geomEdge = GeomEdge.getGeom(e)
      const c = GeomEdge.getGeom(e).curve
      if (c instanceof Curve) {
        for (const seg of c.segs) {
          topLevelTile.addElement({edge: e, curve: seg, startPar: seg.parStart, endPar: seg.parEnd})
        }
      } else {
        topLevelTile.addElement({edge: e, curve: c, startPar: c.parStart, endPar: c.parEnd})
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

    if (!this.needToSubdivide()) return 1 // we have only one layer

    for (let i = 1; i <= z; i++) {
      if (this.subdivideLevel(i)) {
        break
      }
    }
    this.sortedNodes = Array.from(this.pageRank.keys()).sort(this.compareByPagerank.bind(this))
    for (let i = 0; i < this.sortedNodes.length; i++) {
      this.nodeIndexInSortedNodes.set(this.sortedNodes[i], i)
    }

    const ers = getEdgeRoutingSettingsFromAncestorsOrDefault(this.geomGraph)
    const useCorridor = ers.EdgeRoutingMode === EdgeRoutingMode.Corridor

    if (useCorridor) {
      // New scheme: finest level unchanged. For each coarser level, double each node's
      // effective box; greedily accept nodes by rank, dropping those whose scaled box
      // overlaps an already-accepted higher-ranked node's scaled box. Edges are rerouted
      // using the finer level's curves as a corridor hint for the CDT dual-graph A*.
      const lastIdx = this.levels.length - 1
      const activeByLevel: Set<Node>[] = new Array(this.levels.length)
      activeByLevel[lastIdx] = this.setOfNodesOnTheLevel(lastIdx)
      this.numberOfNodesOnLevel = new Array(this.levels.length)
      this.numberOfNodesOnLevel[lastIdx] = activeByLevel[lastIdx].size
      // Per-level display scales (so the sparse surviving set at coarse levels
      // is rendered large enough to be readable at that zoom).
      this.nodeScales = new Array(this.levels.length)
      this.nodeScales[lastIdx] = new Map<Node, number>()
      for (const n of activeByLevel[lastIdx]) this.nodeScales[lastIdx].set(n, 1)

      // Compute active sets finest -> coarsest with k-first + adaptive scaling.
      // The filter margin must be ≥ (padding + extraObstaclePadding) + desiredGap/2 so
      // that, after both the filter's margin and the CDT's obstacle inflation are
      // applied, a real gap remains between obstacles for bezier bulge / arrowheads /
      // edge labels. extraObstaclePadding below mirrors what we pass to
      // routeCorridorEdges (= ers.Padding). desiredGap of ers.Padding gives ~one Padding
      // of visible breathing room between inflated obstacles on coarse levels.
      const extraObstaclePadding = ers.Padding
      const desiredGap = 3 * ers.Padding
      const filterMargin = 2 * ers.Padding + extraObstaclePadding + desiredGap
      for (let k = lastIdx - 1; k >= 0; k--) {
        const desiredMax = Math.pow(2, lastIdx - k)
        const finerScale = desiredMax / 2
        const result = this.selectTopKWithAdaptiveScale(activeByLevel[k + 1], desiredMax, finerScale, filterMargin)
        activeByLevel[k] = result.nodes
        this.nodeScales[k] = result.scales
        this.numberOfNodesOnLevel[k] = activeByLevel[k].size
      }

      // Apply filtered sets to tiles and reroute per level, using previous-level curves.
      for (let k = lastIdx - 1; k >= 0; k--) {
        this.applyActiveSetToLevel(k, activeByLevel[k])
        const activeNodes = activeByLevel[k]
        const activeEdges = Array.from(this.geomGraph.deepEdges).filter((e) => edgeNodesBelongToSet(e.edge, activeNodes))
        if (activeEdges.length > 0) {
          // Snapshot current (finer-level) curves *before* rerouting mutates them.
          const prevRoutes = new Map<GeomEdge, ICurve>()
          for (const e of activeEdges) {
            if (e.curve) prevRoutes.set(e, e.curve)
          }
          const scaleMap = this.nodeScales[k]
          const nodeScale = (n: GeomNode) => scaleMap.get(n.node) ?? 1
          const activeGeomNodes = new Set<GeomNode>()
          for (const n of activeNodes) {
            const gn = GeomNode.getGeom(n)
            if (gn) activeGeomNodes.add(gn)
          }
          routeCorridorEdges(this.geomGraph, activeEdges, null, ers.Padding, prevRoutes, nodeScale, activeGeomNodes, extraObstaclePadding, `level-${k}`)
        }
        this.regenerateCurveClipsUpToLevel(k, activeNodes)
      }
    } else {
      // filter out entities that are not visible on lower layers.
      // do not filter the uppermost layer: it should show everything
      this.numberOfNodesOnLevel = []
      for (let i = 0; i < this.levels.length - 1; i++) {
        this.numberOfNodesOnLevel.push(this.filterOutEntities(this.levels[i], i))
      }
      this.numberOfNodesOnLevel.push(this.sortedNodes.length)

      const sr = new SplineRouter(this.geomGraph, [])
      for (let i = this.levels.length - 2; i >= 0; i--) {
        const activeNodes = this.setOfNodesOnTheLevel(i)
        sr.rerouteOnSubsetOfNodes(activeNodes)
        this.regenerateCurveClipsUpToLevel(i, activeNodes)
      }
    }
    this.calculateNodeRank()
    return this.levels.length
  }

  /** Greedy scaled-overlap filter. Input: candidate node set (typically the next-finer
   *  level's active set). Output: accepted nodes (subset) such that no two accepted
   *  nodes' bounding boxes—scaled around their centers by `scale`—intersect, with
   *  higher-pagerank nodes winning ties. O(n^2) in the candidate set; fine for the
   *  small active sets at coarse levels. */
  private filterByScaledOverlap(candidates: Set<Node>, scale: number, margin = 0): Set<Node> {
    const sorted: Node[] = Array.from(candidates).sort(this.compareByPagerank.bind(this))
    const accepted: Rectangle[] = []
    const acceptedSet = new Set<Node>()
    for (const n of sorted) {
      const gn = GeomNode.getGeom(n)
      if (!gn) continue
      const center = gn.boundingBox.center
      const w = gn.boundingBox.width * scale + 2 * margin
      const h = gn.boundingBox.height * scale + 2 * margin
      const box = Rectangle.mkSizeCenter(new Size(w, h), center)
      let overlaps = false
      for (const a of accepted) {
        if (a.intersects(box)) { overlaps = true; break }
      }
      if (!overlaps) {
        accepted.push(box)
        acceptedSet.add(n)
      }
    }
    return acceptedSet
  }

  /** k-first selection with adaptive per-node scaling.
   *  - Sort candidates by rank DESC.
   *  - Take the top half (k = ceil(|candidates|/2)).
   *  - For each (rank-DESC), pick the largest scale in `[1 .. desiredMax]` (decreasing in
   *    0.85× steps) such that the inflated-by-margin box doesn't intersect any
   *    already-accepted box.
   *  - If even at scale 1 it overlaps an accepted box, the node is dropped. */
  private selectTopKWithAdaptiveScale(
    candidates: Set<Node>,
    desiredMax: number,
    _finerScale: number,
    margin: number,
  ): {nodes: Set<Node>; scales: Map<Node, number>} {
    const sorted: Node[] = Array.from(candidates).sort(this.compareByPagerank.bind(this))
    const k = Math.max(1, Math.ceil(sorted.length / 2))
    const topK = sorted.slice(0, k)
    // Pre-compute each candidate's unit (scale=1) inflated box so we can prevent a bigger
    // higher-ranked node from swallowing its neighbors.
    const unitBox = new Map<Node, Rectangle>()
    for (const n of topK) {
      const gn = GeomNode.getGeom(n)
      if (!gn) continue
      unitBox.set(n, Rectangle.mkSizeCenter(new Size(gn.boundingBox.width + 2 * margin, gn.boundingBox.height + 2 * margin), gn.boundingBox.center))
    }
    const accepted: Rectangle[] = []
    const nodes = new Set<Node>()
    const scales = new Map<Node, number>()
    const STEP = 0.85
    const MIN_SCALE = 1
    // Monotonic-scale invariant: a lower-ranked node must never receive a larger
    // scale than any higher-ranked node already accepted. We iterate topK in
    // rank-DESC order, so capping `maxScale` by the smallest accepted scale so
    // far enforces monotonicity across accepted nodes.
    let maxScale = desiredMax
    for (let ii = 0; ii < topK.length; ii++) {
      const n = topK[ii]
      const gn = GeomNode.getGeom(n)
      if (!gn) continue
      const center = gn.boundingBox.center
      const w0 = gn.boundingBox.width
      const h0 = gn.boundingBox.height
      let chosen = -1
      const scaleSequence: number[] = []
      for (let s = maxScale; s > MIN_SCALE; s *= STEP) scaleSequence.push(s)
      scaleSequence.push(MIN_SCALE)
      for (const s of scaleSequence) {
        const box = Rectangle.mkSizeCenter(new Size(w0 * s + 2 * margin, h0 * s + 2 * margin), center)
        let overlaps = false
        for (const a of accepted) if (a.intersects(box)) { overlaps = true; break }
        if (!overlaps && s > MIN_SCALE + 1e-9) {
          // Only enforce the "don't swallow a lower-ranked neighbor" guard when we are
          // actually *enlarging* beyond unit scale. At s == MIN_SCALE the higher-ranked
          // node must win: if its unit box overlaps a lower-ranked candidate's unit box,
          // we still keep the higher-ranked one and let the lower-ranked candidate be
          // dropped when its own turn comes.
          for (let jj = ii + 1; jj < topK.length; jj++) {
            const other = unitBox.get(topK[jj])
            if (!other) continue
            if (box.intersects(other)) { overlaps = true; break }
          }
        }
        if (!overlaps) { chosen = s; break }
      }
      if (chosen < 0) continue
      const finalBox = Rectangle.mkSizeCenter(new Size(w0 * chosen + 2 * margin, h0 * chosen + 2 * margin), center)
      accepted.push(finalBox)
      nodes.add(n)
      scales.set(n, chosen)
      if (chosen < maxScale) maxScale = chosen
    }
    return {nodes, scales}
  }

  /** Restrict a level's tile contents to the given active node set. Edges/labels
   *  whose source or target is outside the active set are removed; curve clips
   *  are cleared (they'll be rebuilt by regenerateCurveClipsUpToLevel). */
  private applyActiveSetToLevel(levelIdx: number, activeNodes: Set<Node>) {
    for (const tile of this.levels[levelIdx].values()) {
      tile.nodes = tile.nodes.filter((gn) => activeNodes.has(gn.node))
      tile.labels = tile.labels.filter((lab) => {
        const parent = lab.parent
        if (parent instanceof GeomEdge) {
          return activeNodes.has(parent.edge.source) && activeNodes.has(parent.edge.target)
        }
        return true
      })
      tile.arrowheads = tile.arrowheads.filter(
        (a) => activeNodes.has(a.edge.source) && activeNodes.has(a.edge.target),
      )
      tile.initCurveClips()
    }
    this.removeEmptyTiles(levelIdx)
  }

  // private makeSomeNodesVizible() {
  //   for (let levelIndex = 0; levelIndex < this.levels.length - 1; levelIndex++) {
  //     this.calculateNodeAdditionalScales(levelIndex)
  //   }
  // }
  // calculateNodeAdditionalScalesOnLevelZero() {
  //   const tree = new RTree()
  //   // we always get at least one intersection with the whole graph record
  //   tree.batchInsert([
  //     {
  //       x: this.geomGraph.left,
  //       y: this.geomGraph.bottom,
  //       width: this.geomGraph.width,
  //       height: this.geomGraph.height,
  //       data: {node: this.geomGraph.graph, nodeBB: this.geomGraph.boundingBox},
  //     },
  //   ]) // to init with the whole
  //   const scales = new Map<Node, number>()
  //   this.nodeScales.push(scales)
  //   // with this scale the node will be rendered at level[this.level.length -1]
  //   let scale = Math.pow(2, this.levels.length - 1)
  //   for (let j = 0; j < this.numberOfNodesOnLevel[0]; j++) {
  //     const n = this.sortedNodes[j]

  //     scale = this.findMaxScaleToNotIntersectTree(n, tree, scale)
  //     if (scale < 1.1) break // getting almost no enlargement
  //     scales.set(n, scale)
  //   }
  // }

  // findMaxScaleToNotIntersectTree(n: Node, tree: RTree, maxScale: number): number {
  //   const geomNode = GeomNode.getGeom(n)
  //   let nodeBB = geomNode.boundingBox
  //   // make sure that we are not rendering the node outside of  the the graph bounding box
  //   maxScale = Math.min(this.keepInsideGraphBoundingBox(nodeBB), maxScale)

  //   const ret = this.intersectWithTreeAndGetScale(tree, nodeBB, maxScale)
  //   // use the resulting bounding box and insert it to the tree
  //   nodeBB = geomNode.boundingBox.clone()
  //   nodeBB.scaleAroundCenter(ret)
  //   tree.insert({x: nodeBB.left, y: nodeBB.bottom, width: nodeBB.width, height: nodeBB.height, data: {node: n, nodeBB: nodeBB}})
  //   return ret
  // }
  /** returns the maximal scale keeping nodeBB inside of the graph bounding box */
  private keepInsideGraphBoundingBox(nodeBB: Rectangle): number {
    const graphBB = this.geomGraph.boundingBox
    const w = nodeBB.width / 2
    const h = nodeBB.height / 2

    const keepInsideScale = Math.min(
      // left stays inside
      (nodeBB.center.x - graphBB.left) / w,
      // top stays inside
      (graphBB.top - nodeBB.center.y) / h,
      // right stays inside
      (graphBB.right - nodeBB.center.x) / w,
      //bottom stays inside
      (nodeBB.center.y - graphBB.bottom) / h,
    )
    return keepInsideScale
  }

  // intersectWithTreeAndGetScale(tree: RTree, nodeBB: Rectangle, maxScale: number): number {
  //   const xx = tree.search({x: nodeBB.left, y: nodeBB.bottom, width: nodeBB.width, height: nodeBB.height}) as {
  //     node: Node
  //     nodeBB: Rectangle
  //   }[]
  //   if (xx.length == 1) return maxScale // there is always one intersection with the whole graph
  //   let scale = maxScale
  //   for (const x of xx) {
  //     if (x.node == this.geomGraph.graph) continue
  //     scale = this.diminishScaleToAvoidTree(x.node, x.nodeBB, nodeBB)
  //     if (scale == 1) return scale // no separation
  //   }
  //   return scale
  // }
  diminishScaleToAvoidTree(intersectedNode: Node, intersectedRect: Rectangle, nodeBB: Rectangle): number {
    Assert.assert(intersectedRect.intersects(nodeBB))

    let scaleX: number
    const x = nodeBB.center.x
    const y = nodeBB.center.y
    const h = nodeBB.height / 2
    const w = nodeBB.width / 2
    if (x < intersectedRect.left) {
      scaleX = (intersectedRect.left - x) / h
    } else if (x > intersectedRect.right) {
      scaleX = (x - intersectedRect.right) / h
    } else {
      return 1
    }

    let scaleY: number
    if (y < intersectedRect.bottom) {
      scaleY = (intersectedRect.bottom - y) / w
    } else if (y > intersectedRect.top) {
      scaleY = (y - intersectedRect.top) / w
    } else {
      return scaleX
    }

    return Math.min(scaleX, scaleY)
  }

  // calculateNodeAdditionalScales(levelIndex: number) {
  //   const tree = new RTree()
  //   // we always get at least one intersection with the whole graph record
  //   tree.batchInsert([
  //     {
  //       x: this.geomGraph.left,
  //       y: this.geomGraph.bottom,
  //       width: this.geomGraph.width,
  //       height: this.geomGraph.height,
  //       data: {node: this.geomGraph.graph, nodeBB: this.geomGraph.boundingBox},
  //     },
  //   ]) // to init with the whole graph bounding box
  //   const scales = new Map<Node, number>()
  //   this.nodeScales.push(scales)
  //   let scale = Math.pow(2, this.levels.length - 1 - levelIndex)
  //   for (let j = 0; j < this.numberOfNodesOnLevel[levelIndex]; j++) {
  //     const n = this.sortedNodes[j]
  //     scale = this.findMaxScaleToNotIntersectTree(n, tree, scale)
  //     if (scale <= 1) break
  //     scales.set(n, scale)
  //   }
  // }

  // findMaxScale(n: Node, levelIndex: number, tree: RTree, maxScale: number): number {
  //   const geomNode = GeomNode.getGeom(n)
  //   let boundingBox = geomNode.boundingBox.clone()
  //   boundingBox.scaleAroundCenter(maxScale)
  //   let ret = maxScale
  //   while (ret > 1 && treeIntersectsRect(tree, boundingBox)) {
  //     ret /= 2
  //     if (ret < 1) ret = 1
  //   }
  //   boundingBox = geomNode.boundingBox.clone()
  //   boundingBox.scaleAroundCenter(ret)
  //   tree.insert({x: boundingBox.left, y: boundingBox.bottom, width: boundingBox.width, height: boundingBox.height})
  //   return ret
  // }

  private needToSubdivide() {
    let needSubdivide = false
    for (const tile of this.levels[0].values()) {
      if (tile.entityCount > this.tileCapacity) {
        needSubdivide = true
        break
      }
    }
    return needSubdivide
  }

  setOfNodesOnTheLevel(i: number): Set<Node> {
    const ret = new Set<Node>()
    for (const t of this.levels[i].values()) {
      for (const node of t.nodes) {
        ret.add(node.node)
      }
    }
    return ret
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

  regenerateCurveClipsUpToLevel(levelIndex: number, activeNodes: Set<Node>) {
    this.clearCurveClipsInLevelsUpTo(levelIndex)
    for (const t of this.levels[0].values()) {
      this.regenerateCurveClipsUnderTileUpToLevel(t, levelIndex, activeNodes)
    }
  }
  private clearCurveClipsInLevelsUpTo(levelIndex: number) {
    for (let i = 0; i <= levelIndex; i++) {
      for (const t of this.levels[i].values()) {
        t.initCurveClips()
      }
    }
  }

  regenerateCurveClipsUnderTileUpToLevel(t: Tile, levelIndex: number, activeNodes: Set<Node>) {
    t.arrowheads = []
    t.initCurveClips()
    for (const geomEdge of this.geomGraph.deepEdges) {
      if (!edgeNodesBelongToSet(geomEdge.edge, activeNodes)) continue
      if (geomEdge.curve instanceof Curve) {
        for (const seg of geomEdge.curve.segs) {
          t.addElement({edge: geomEdge.edge, curve: seg, startPar: seg.parStart, endPar: seg.parEnd})
        }
      } else {
        t.addElement({edge: geomEdge.edge, curve: geomEdge.curve, startPar: geomEdge.curve.parStart, endPar: geomEdge.curve.parEnd})
      }
      if (geomEdge.sourceArrowhead) {
        t.arrowheads.push({edge: geomEdge.edge, tip: geomEdge.sourceArrowhead.tipPosition, base: geomEdge.curve.start})
      }
      if (geomEdge.targetArrowhead) {
        t.arrowheads.push({edge: geomEdge.edge, tip: geomEdge.targetArrowhead.tipPosition, base: geomEdge.curve.end})
      }
    }
    // do not change the labels
    // Now the root tile(s) is ready
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
      this.subdivideTile(key, z, tile, /** for regenerate */ true)
    }
  }
  // regenerateUnderOneTile(key: IntPair, upperTile: Tile, z: number) {
  //   const subTilesRects = createSubTileRects()
  //   const clipsPerRect = this.regenerateCurveClipsUnderTile(upperTile, subTilesRects)
  //   pushRegeneratedClips(this.levels[z])

  //   cleanArrowheadsInSubtiles(this.levels[z])

  //   pushArrowheadsToSubtiles(this.levels[z])

  //   cleanUpSubtilesAboveTile(this.levels[z])
  //   function cleanUpSubtilesAboveTile(level: IntPairMap<Tile>) {
  //     for (let i = 0; i < 2; i++)
  //       for (let j = 0; j < 2; j++) {
  //         const ti = 2 * key.x + i
  //         const tj = 2 * key.y + j
  //         const tile = level.get(ti, tj)
  //         if (tile == null) continue
  //         if (tile.isEmpty()) {
  //           level.delete(ti, tj)
  //         }
  //       }
  //   }

  //   function pushArrowheadsToSubtiles(level: IntPairMap<Tile>) {
  //     for (const arrowhead of upperTile.arrowheads) {
  //       const arrowheadBox = Rectangle.mkPP(arrowhead.base, arrowhead.tip)
  //       const d = arrowhead.tip.sub(arrowhead.base).div(3)
  //       const dRotated = d.rotate90Cw()
  //       arrowheadBox.add(arrowhead.base.add(dRotated))
  //       arrowheadBox.add(arrowhead.base.sub(dRotated))
  //       for (let i = 0; i < 2; i++)
  //         for (let j = 0; j < 2; j++) {
  //           const k = 2 * i + j
  //           if (arrowheadBox.intersects(subTilesRects[k])) {
  //             const ti = 2 * key.x + i
  //             const tj = 2 * key.y + j

  //             level.get(ti, tj).arrowheads.push(arrowhead)
  //           }
  //         }
  //     }
  //   }

  //   function cleanArrowheadsInSubtiles(levelMap: IntPairMap<Tile>) {
  //     for (let i = 0; i < 2; i++)
  //       for (let j = 0; j < 2; j++) {
  //         const ti = 2 * key.x + i
  //         const tj = 2 * key.y + j
  //         const tile = levelMap.get(ti, tj)
  //         if (tile == null) {
  //           continue
  //         }
  //         tile.arrowheads = []
  //       }
  //   }

  //   function pushRegeneratedClips(levelMap: IntPairMap<Tile>) {
  //     for (let i = 0; i < 2; i++)
  //       for (let j = 0; j < 2; j++) {
  //         const k = 2 * i + j
  //         const clips = clipsPerRect[k]

  //         const ti = 2 * key.x + i
  //         const tj = 2 * key.y + j
  //         let tile = levelMap.get(ti, tj)
  //         if (tile == null) {
  //           if (clips.length) {
  //             levelMap.set(ti, tj, (tile = new Tile(subTilesRects[k])))
  //           } else {
  //             continue
  //           }
  //         }
  //         tile.initCurveClips()
  //         for (const clip of clips) {
  //           tile.addElement({edge: clip.edge, curve: clip.curve})
  //         }
  //       }
  //   }

  //   function createSubTileRects() {
  //     const subTilesRects = new Array<Rectangle>()
  //     const w = upperTile.rect.width / 2
  //     const h = upperTile.rect.height / 2
  //     for (let i = 0; i < 2; i++)
  //       for (let j = 0; j < 2; j++) {
  //         const tileRect = new Rectangle({
  //           left: upperTile.rect.left + w * i,
  //           right: upperTile.rect.left + w * (i + 1),
  //           bottom: upperTile.rect.bottom + h * j,
  //           top: upperTile.rect.bottom + h * (j + 1),
  //         })
  //         subTilesRects.push(tileRect)
  //       }
  //     return subTilesRects
  //   }
  // }

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
  private calculateNodeRank() {
    this.nodeRank = new Map<Node, number>()
    const n = this.sortedNodes.length
    const log_n_10 = Math.log10(n)
    for (let i = 0; i < n; i++) {
      this.nodeRank.set(this.sortedNodes[i], log_n_10 - Math.log10(i + 1))
    }
  }
  private compareByPagerank(u: Node, v: Node): number {
    return this.pageRank.get(v) - this.pageRank.get(u)
  }

  /** Fills the tiles up to the capacity.
   * Returns the number of inserted nodes.
   * An edge and its attributes is inserted just after its source and the target are inserted.
   * The nodes are sorted by rank here.  */

  private filterOutEntities(levelToReduce: IntPairMap<Tile>, z: number) {
    // create a map,edgeToIndexOfPrevLevel, from the prevLevel edges to integers,
    // For each edge edgeToIndexOfPrevLevel.get(edge) = min {i: edge == tile.getCurveClips[i].edge}
    const dataByEntityMap = this.transferDataOfLevelToMap(levelToReduce)
    const addedNodes = new Set<Node>()
    for (let k = 0; k < this.sortedNodes.length; k++) {
      const node = this.sortedNodes[k]
      if (this.addNodeToLevel(levelToReduce, node, dataByEntityMap, addedNodes)) {
        addedNodes.add(node)
      }
    }
    this.removeEmptyTiles(z)
    //dumpTiles(levelToReduce, z)
    return addedNodes.size
  }

  /** Goes over all tiles where 'node' had presence and tries to add.
   *  If the above succeeds then all edges leading to already-added nodes are added without consulting with tileCapacity. The edge attributes added as well
   */
  private addNodeToLevel(
    levelToReduce: IntPairMap<Tile>,
    node: Node,
    dataByEntity: Map<Entity, EntityDataInTile[]>,
    addedNodes: Set<Node>,
  ) {
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
    for (const e of node.inEdges) {
      const source = e.source
      if (!addedNodes.has(source)) continue
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
      if (!addedNodes.has(target)) continue
      for (const edt of dataByEntity.get(e)) {
        const tile = edt.tile
        const data = edt.data
        tile.addElement(data)
      }
      if (e.label) {
        if (dataByEntity.get(e.label))
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
    const entityToData = new Map<Entity, EntityDataInTile[]>()
    for (const tile of levelToReduce.values()) {
      for (const clip of tile.curveClips) {
        const edge = clip.edge
        const arr = getCreateEntityDataArray(edge)
        arr.push({tile: tile, data: clip})
      }

      for (const label of tile.labels) {
        const edge = (label.parent as GeomEdge).edge
        const arr = getCreateEntityDataArray(edge)
        arr.push({tile: tile, data: label})
      }
      for (const gnode of tile.nodes) {
        const node = gnode.node
        const arr = getCreateEntityDataArray(node)
        arr.push({tile: tile, data: gnode})
      }
      for (const arrowhead of tile.arrowheads) {
        const edge = arrowhead.edge
        const arr = getCreateEntityDataArray(edge)
        arr.push({tile: tile, data: arrowhead})
      }
      tile.clear()
    }

    return entityToData

    function getCreateEntityDataArray(ent: Entity) {
      let arr = entityToData.get(ent)
      if (!arr) {
        entityToData.set(ent, (arr = new Array<EntityDataInTile>()))
      }
      return arr
    }
  }
  /** It is assumed that the previous level z-1 have been calculated.
   * Returns true if every edge is appears in some tile as the first edge
   */

  private subdivideLevel(z: number): boolean {
    console.log('subdivideLevel', z)
    const tilesInRow = Math.pow(2, z)
    this.levels[z] = new IntPairMap<Tile>()
    /** the width and the height of z-th level tile */
    const allTilesAreSmall = this.subdivideTilesOnLevel(z)
    if (allTilesAreSmall) {
      console.log('done subdividing at level', z, 'because each tile contains less than', this.tileCapacity)
      return true
    }
    const {w, h} = this.getWHOnLevel(z)

    if (w <= this.minTileSize.width && h <= this.minTileSize.height) {
      console.log('done subdividing at level', z, ' because of tile size = ', w, h, 'is less than ', this.minTileSize)
      return true
    }
    return false
  }
  countClips(z: number): number {
    let count = 0
    for (const tile of this.levels[z].values()) {
      count += tile.curveClips.length
    }
    return count
  }

  private getWHOnLevel(z: number) {
    for (let i = this.tileSizes.length; i <= z; i++) {
      const s = this.tileSizes[i - 1]
      this.tileSizes.push(new Size(s.width / 2, s.height / 2))
    }
    return {w: this.tileSizes[z].width, h: this.tileSizes[z].height}
  }

  private subdivideTilesOnLevel(z: number) {
    const tileCount = 0
    let allTilesAreSmall = true

    for (const [key, tile] of this.levels[z - 1].keyValues()) {
      const res = this.subdivideTile(key, z, tile, false)
      allTilesAreSmall &&= res.allSmall
    }
    this.removeEmptyTiles(z)
    console.log('generated', this.levels[z].size, 'tiles')
    return allTilesAreSmall
  }

  private subdivideTile(
    /** the tile key */
    key: IntPair,
    z: number, // the level above the lowerTile level
    /** this is the tile we are subdividing */
    lowerTile: Tile,
    regenerate: boolean,
  ): {count: number; allSmall: boolean} {
    const {w, h} = this.getWHOnLevel(z)
    /** this is the map we collect new tiles to */
    const levelTiles = this.levels[z]

    const xp = key.x
    const yp = key.y
    const left = this.topLevelTileRect.left + xp * w * 2
    const bottom = this.topLevelTileRect.bottom + yp * h * 2
    /** tiles under the upper tile */
    const keys = new Array<IntPair>(4)
    // fill the keys
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        keys[i * 2 + j] = new IntPair(xp * 2 + i, yp * 2 + j)
      }
    }

    if (!regenerate) {
      this.generateSubtilesWithoutTileClips(left, w, bottom, h, keys, lowerTile, z)
    } else {
      // regenerate mode: re-propagate arrowheads from the (updated) upper tile into
      // existing subtiles so they stay consistent with the rerouted curves.
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const k = i * 2 + j
          const sub = levelTiles.getI(keys[k])
          if (sub == null) continue
          sub.arrowheads = []
          const subRect = sub.rect
          for (const arrowhead of lowerTile.arrowheads) {
            const arrowheadBox = Rectangle.mkPP(arrowhead.base, arrowhead.tip)
            const d = arrowhead.tip.sub(arrowhead.base).div(3)
            const dRotated = d.rotate90Cw()
            arrowheadBox.add(arrowhead.base.add(dRotated))
            arrowheadBox.add(arrowhead.base.sub(dRotated))
            if (arrowheadBox.intersects(subRect)) sub.arrowheads.push(arrowhead)
          }
        }
    }
    const horizontalMiddleLine = new LineSegment(left, bottom + h, left + 2 * w, bottom + h)
    const verticalMiddleLine = new LineSegment(left + w, bottom, left + w, bottom + 2 * h)
    subdivideWithCachedClipsAboveTile()
    let r = 0
    let allSmall = true
    for (const key of keys) {
      const tile = levelTiles.get(key.x, key.y)
      if (tile == null) continue
      r++
      if (tile.entityCount > this.tileCapacity) {
        allSmall = false
      }
    }
    return {count: r, allSmall: allSmall}

    // local functions
    function subdivideWithCachedClipsAboveTile() {
      //create temparary PointPairMap to store the result of the intersection
      // each entry in the map is an array of curves corresponding to the intersections with one subtile

      for (const clip of lowerTile.curveClips) {
        // Assert.assert(upperTile.rect.containsRect(cs.curve.boundingBox))
        const cs = clip.curve
        const xs = intersectWithMiddleLines(cs, clip.startPar, clip.endPar)

        Assert.assert(xs.length >= 2)
        if (xs.length == 2) {
          const t = (xs[0] + xs[1]) / 2
          const p = cs.value(t)
          const i = p.x <= left + w ? 0 : 1
          const j = p.y <= bottom + h ? 0 : 1
          const k = 2 * i + j
          const key = keys[k]
          let tile = levelTiles.getI(key)
          if (!tile) {
            const l = left + i * w
            const b = bottom + j * h
            tile = new Tile(new Rectangle({left: l, bottom: b, top: b + h, right: l + w}))
            levelTiles.setPair(key, tile)
          }
          tile.addCurveClip({curve: cs, edge: clip.edge, startPar: xs[0], endPar: xs[1]})
        } else
          for (let u = 0; u < xs.length - 1; u++) {
            const t = (xs[u] + xs[u + 1]) / 2
            const p = cs.value(t)
            const i = p.x <= left + w ? 0 : 1
            const j = p.y <= bottom + h ? 0 : 1
            const k = 2 * i + j
            //const tr = cs.trim(xs[u][1], xs[u + 1][1])
            const key = keys[k]
            let tile = levelTiles.getI(key)
            if (!tile) {
              const l = left + i * w
              const b = bottom + j * h
              tile = new Tile(new Rectangle({left: l, bottom: b, top: b + h, right: l + w}))
              levelTiles.setPair(key, tile)
            }
            tile.addCurveClip({curve: cs, edge: clip.edge, startPar: xs[u], endPar: xs[u + 1]})
          }
      }
    }

    function intersectWithMiddleLines(seg: ICurve, start: number, end: number): Array<number> {
      // point, parameter
      let xs = Array.from(Curve.getAllIntersections(seg, horizontalMiddleLine, true))
        .concat(Array.from(Curve.getAllIntersections(seg, verticalMiddleLine, true)))
        .map((x) => x.par0)
      xs.sort((a, b) => a - b)
      return [start].concat(xs.filter((x) => x >= start && x <= end)).concat(end)
    }
  }

  /** returns the updated value of allTilesAreSmall */
  private addSubtilesToLevel(tdArr: Tile[], levelTiles: IntPairMap<Tile>, xp: number, yp: number, allTilesAreSmall: boolean) {
    //debCount++
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const tile = tdArr[i * 2 + j]
        if (!tile.isEmpty()) {
          levelTiles.set(2 * xp + i, 2 * yp + j, tile)
          // try {
          //   if (debCount % 10 === 0) {
          //     const cc = Array.from(tile.getCurveClips())

          //     // SvgDebugWriter.dumpDebugCurves(
          //     //   './tmp/tile' + debCount + '-' + (2 * xp + i) + '-' + (2 * yp + j) + '.svg',
          //     //   cc
          //     //     .map((c) => DebugCurve.mkDebugCurveCI('Green', c.curve))
          //     //     .concat([DebugCurve.mkDebugCurveTWCI(100, 0.2, 'Black', tile.rect.perimeter())])
          //     //     .concat(tile.nodes.map((n) => DebugCurve.mkDebugCurveCI('Red', n.boundaryCurve)))
          //     //     .concat(tile.arrowheads.map((t) => LineSegment.mkPP(t.base, t.tip)).map((l) => DebugCurve.mkDebugCurveWCI(1, 'Blue', l))),
          //     // )
          //   }
          // } catch (e) {}
          if (allTilesAreSmall && tile.entityCount > this.tileCapacity) {
            //console.log('found a tile at level', z, ' with ', tile.elementCount, 'elements, which is greater than', this.tileCapacity)
            allTilesAreSmall = false
          }
        }
      }

    return allTilesAreSmall
  }

  private generateSubtilesWithoutTileClips(
    left: number,
    w: number,
    bottom: number,
    h: number,
    keysAbove: IntPair[],
    upperTile: Tile,
    z: number,
  ) {
    let k = 0
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const tileRect = new Rectangle({
          left: left + w * i,
          right: left + w * (i + 1),
          bottom: bottom + h * j,
          top: bottom + h * (j + 1),
        })
        const tile = this.generateOneSubtileExceptEdgeClips(upperTile, tileRect)
        if (tile) {
          this.levels[z].set(keysAbove[k].x, keysAbove[k].y, tile)
        }
        k++
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

  private generateOneSubtileExceptEdgeClips(upperTile: Tile, tileRect: Rectangle): Tile {
    const tile = new Tile(tileRect)

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
    if (tile.isEmpty()) return null
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

// function treeIntersectsRect(tree: RTree, boundingBox: Rectangle): boolean {
//   const bb = {x: boundingBox.left, y: boundingBox.bottom, width: boundingBox.width, height: boundingBox.height}
//   const a = tree.search(bb)
//   return a && a.length > 0
// }
// function dumpTiles(tileMap: IntPairMap<Tile>, z: number) {
//   for (const [p, tile] of tileMap.keyValues()) {
//     try {
//       const cc = Array.from(tile.getCurveClips()).map((c) => c.curve)
//       SvgDebugWriter.dumpDebugCurves(
//         './tmp/filteredTile' + z + '-' + p.x + '-' + p.y + '.svg',
//         cc
//           .map((c) => DebugCurve.mkDebugCurveCI('Green', c))
//           .concat([DebugCurve.mkDebugCurveTWCI(100, 0.2, 'Black', tile.rect.perimeter())])
//           .concat(tile.nodes.map((n) => DebugCurve.mkDebugCurveCI('Red', n.boundaryCurve)))
//           .concat(tile.arrowheads.map((t) => LineSegment.mkPP(t.base, t.tip)).map((l) => DebugCurve.mkDebugCurveWCI(1, 'Blue', l))),
//       )
//     } catch (Error) {
//       console.log(Error.message)
//     }
//   }
// }
