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
import {routeSleeveEdges} from '../../routing/sleeveRouter'
import {EdgeRoutingMode} from '../../routing/EdgeRoutingMode'
import {getEdgeRoutingSettingsFromAncestorsOrDefault} from '../driver'
import {Assert} from '../../utils/assert'
//import {RTree} from 'hilbert-rtree/build'

/** Represents a part of the curve containing in a tile.
 * The tile part of the curve is defined by the startPar and endPar.
 * One tile can have several parts of clips corresponding to the same curve.
 *
 * Within a tile, clips that share the same lex-ordered (start, end) endpoint
 * pair are bundled into a single CurveClip whose `edges` list accumulates
 * every contributing edge; the bundled geometry is taken from the first
 * occurrence. The bundle is rendered as one entity. */
export type CurveClip = {curve: ICurve; edges: Edge[]; startPar: number; endPar: number}
export type ArrowHeadData = {tip: Point; edge: Edge; base: Point}
type EntityDataInTile = {tile: Tile; data: CurveClip | ArrowHeadData | GeomLabel | GeomNode}

/** Approximate footprint of a single stored tile element (curve clip, node copy,
 *  arrowhead, or label). Used by the memory-budget stop in buildUpToLevel. */
const BYTES_PER_ELEMENT = 200

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
  /** Memory budget in bytes; if the running total of stored tile elements
   *  times BYTES_PER_ELEMENT exceeds this value after building a candidate
   *  finest level, that level is discarded and Z is set to the previous one.
   *  Default 4 GB. */
  private maxMemoryBytes: number = 4 * 1024 * 1024 * 1024
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
   * tileCapacity - per-tile element cap (default 500).
   * maxMemoryBytes - memory budget for the tile pyramid (default 4 GB).
   *   After each candidate finest level, the running total of stored tile
   *   elements times BYTES_PER_ELEMENT is compared against this budget; if
   *   exceeded the level is discarded and growth stops.
   */
  constructor(geomGraph: GeomGraph, topLevelTileRect: Rectangle, tileCapacity?: number, maxMemoryBytes?: number) {
    this.geomGraph = geomGraph
    this.topLevelTileRect = topLevelTileRect
    if (tileCapacity != null) this.tileCapacity = tileCapacity
    if (maxMemoryBytes != null) this.maxMemoryBytes = maxMemoryBytes
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
      if (geomEdge == null) return
      const c = geomEdge.curve
      if (c == null) return
      if (c instanceof Curve) {
        for (const seg of c.segs) {
          topLevelTile.addElement({edges: [e], curve: seg, startPar: seg.parStart, endPar: seg.parEnd})
        }
      } else {
        topLevelTile.addElement({edges: [e], curve: c, startPar: c.parStart, endPar: c.parEnd})
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
   *  It also stops mid-build, while generating the tiles of the current finest
   *  level, as soon as the running total of stored tile elements times
   *  BYTES_PER_ELEMENT exceeds this.maxMemoryBytes; the partial level is then
   *  discarded and Z is set to the previous finest level.
   * Returns the number of created levels.
   */
  buildUpToLevel(z: number): number {
    this.fillTheLowestLayer()
    this.minTileSize = this.getMinTileSize()
    this.pageRank = pagerank(this.geomGraph.graph, 0.85)

    if (!this.needToSubdivide()) return 1 // we have only one layer

    const maxElements = Math.floor(this.maxMemoryBytes / BYTES_PER_ELEMENT)
    let baseElements = this.totalStoredElements() // elements stored on level 0
    for (let i = 1; i <= z; i++) {
      const res = this.subdivideLevel(i, baseElements, maxElements)
      if (res.aborted) {
        // The partial level i pushed us past the memory budget; drop it
        // entirely and use level i-1 as the finest.
        this.levels.pop()
        if (this.tileSizes.length > this.levels.length) this.tileSizes.pop()
        break
      }
      if (res.stop) break
      baseElements = this.totalStoredElements()
    }
    this.sortedNodes = Array.from(this.pageRank.keys()).sort(this.compareByPagerank.bind(this))
    for (let i = 0; i < this.sortedNodes.length; i++) {
      this.nodeIndexInSortedNodes.set(this.sortedNodes[i], i)
    }

    const ers = getEdgeRoutingSettingsFromAncestorsOrDefault(this.geomGraph)
    const useSleeve = ers.EdgeRoutingMode === EdgeRoutingMode.Sleeve

    if (useSleeve) {
      // New scheme: finest level unchanged. For each coarser level, double each node's
      // effective box; greedily accept nodes by rank, dropping those whose scaled box
      // overlaps an already-accepted higher-ranked node's scaled box. Edges are rerouted
      // per level on the active node subset using a grouped Dijkstra tree per source on
      // the CDT dual graph (A* is only used as a fallback for targets whose center lies
      // inside another inflated obstacle at coarse tile levels).
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
      // routeSleeveEdges (= ers.Padding). desiredGap of ers.Padding gives ~one Padding
      // of visible breathing room between inflated obstacles on coarse levels.
      const extraObstaclePadding = ers.Padding
      const desiredGap = 3 * ers.Padding
      const filterMargin = 2 * ers.Padding + extraObstaclePadding + desiredGap
      // BUG FIX: candidates at every coarser level are taken from a prefix of the
      // GLOBAL rank-sorted node list, not from the previous coarser level's accepted
      // set. Otherwise a high-rank node rejected once due to overlap (against an
      // even-higher-rank neighbor at a finer level) would be permanently dropped from
      // every coarser level, even where its inflated box would fit. Working on a
      // global prefix guarantees that V_z ⊆ V_{z+1} (acceptance is monotone in z
      // because at coarser levels boxes are larger, so overlap can only get worse;
      // a node accepted at coarse z must also be accepted at every finer z' > z).
      // The prefix size halves per level so the candidate set still shrinks
      // exponentially, matching the original "top half" intent.
      const N = this.sortedNodes.length
      for (let k = lastIdx - 1; k >= 0; k--) {
        const desiredMax = Math.pow(2, lastIdx - k)
        const prefixSize = Math.max(1, Math.ceil(N / Math.pow(2, lastIdx - k)))
        const prefix = this.sortedNodes.slice(0, prefixSize)
        const result = this.selectTopKWithAdaptiveScale(prefix, desiredMax, filterMargin)
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
          const scaleMap = this.nodeScales[k]
          const nodeScale = (n: GeomNode) => scaleMap.get(n.node) ?? 1
          const activeGeomNodes = new Set<GeomNode>()
          for (const n of activeNodes) {
            const gn = GeomNode.getGeom(n)
            if (gn) activeGeomNodes.add(gn)
          }
          routeSleeveEdges(this.geomGraph, activeEdges, null, false, ers.Padding, nodeScale, activeGeomNodes, extraObstaclePadding, `level-${k}`, ers.smoothCorners)
        }
        this.clipEdgesIntoLevel(k, activeNodes)
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
        this.clipEdgesIntoLevel(i, activeNodes)
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

  /** Adaptive per-node scaling on a globally-rank-sorted prefix.
   *  - Input `topK` is already sorted by rank DESC and pre-truncated by the caller
   *    to the level's prefix size; this function does NOT re-sort or further halve it.
   *  - For each node (in the given order), compute the largest scale in
   *    `[1, desiredMax]` such that the inflated-by-margin box does not intersect
   *    any already-accepted box. The largest admissible scale is obtained in
   *    closed form per accepted box: for axis-aligned rectangles, non-intersection
   *    (modulo distanceEpsilon) means that on at least one axis the centers are
   *    separated by more than the sum of the inflated half-extents; each axis
   *    yields a linear upper bound on s, and we take the more permissive axis per
   *    accepted box and the strictest over all accepted boxes. If the bound drops
   *    below MIN_SCALE the candidate is dropped; otherwise the chosen scale is
   *    min(maxScale, bound).
   *  - The cap `maxScale` is then tightened to enforce monotonicity in rank. */
  private selectTopKWithAdaptiveScale(
    topK: Node[],
    desiredMax: number,
    margin: number,
  ): {nodes: Set<Node>; scales: Map<Node, number>} {
    type AcceptedInfo = {cx: number; cy: number; halfWInflated: number; halfHInflated: number}
    const acceptedInfo: AcceptedInfo[] = []
    const nodes = new Set<Node>()
    const scales = new Map<Node, number>()
    const MIN_SCALE = 1
    const eps = GeomConstants.distanceEpsilon
    // Largest half-extent any candidate could occupy. Used to size the spatial
    // grid: two inflated boxes at scale ≤ desiredMax both have full extent ≤
    // 2*(desiredMax*halfMax + margin) on each axis, so any pair that intersects
    // must lie in the same or an adjacent cell.
    let halfMax = 0
    for (const n of topK) {
      const gn = GeomNode.getGeom(n)
      if (!gn) continue
      const h = Math.max(gn.boundingBox.width, gn.boundingBox.height) / 2
      if (h > halfMax) halfMax = h
    }
    // Spatial hash for O(1)-amortized overlap checking. Cell size is chosen so
    // that any inflated accepted box and any candidate's inflated box at scale
    // ≤ desiredMax both have full extent ≤ cellSize on each axis. Two such boxes
    // can only intersect if their center cells differ by at most 1 on each axis,
    // i.e. lie in the candidate's 3×3 cell neighborhood. Falls back to direct
    // loop only when halfMax==0 (degenerate empty topK).
    const cellSize = 2 * (desiredMax * halfMax + margin)
    const useGrid = cellSize > eps
    const grid = new Map<number, AcceptedInfo[]>()
    // Pack signed (cx,cy) cell coords into one number key. Cell coords are
    // bounded by graph extent / cellSize and fit comfortably in 16 bits each
    // for any realistic layout, so multiplying x by 0x10000 and adding y
    // (after biasing) avoids collisions for our use case.
    const KEY_BIAS = 1 << 15
    const KEY_STRIDE = 1 << 16
    const cellKey = (cx: number, cy: number) => (cx + KEY_BIAS) * KEY_STRIDE + (cy + KEY_BIAS)
    // Monotonic-scale invariant: a lower-ranked node must never receive a larger
    // scale than any higher-ranked node already accepted. We iterate topK in
    // rank-DESC order, so capping `maxScale` by the smallest accepted scale so
    // far enforces monotonicity across accepted nodes.
    // We deliberately do NOT forbid a higher-ranked node from "swallowing" a
    // lower-ranked neighbor's unit box: at coarse levels the user wants fewer,
    // bigger, more-important nodes visible, so dropping nearby lower-ranked
    // neighbors in favor of a big top-ranked node is desired behavior.
    let maxScale = desiredMax
    for (let ii = 0; ii < topK.length; ii++) {
      const n = topK[ii]
      const gn = GeomNode.getGeom(n)
      if (!gn) continue
      const center = gn.boundingBox.center
      const w0 = gn.boundingBox.width
      const h0 = gn.boundingBox.height
      const halfW = w0 / 2
      const halfH = h0 / 2
      // Closed-form upper bound on s such that B_m(v, s) does not intersect any
      // accepted B_m(u, s_u). For each accepted box centered at (cu_x, cu_y)
      // with inflated half-extents (HWu, HHu), separation along x requires
      //   s*halfW + margin + HWu + eps < |dx|   =>   s < (|dx| - margin - HWu - eps)/halfW,
      // and similarly along y. The candidate is admissible at scale s iff at
      // least one axis is satisfied for every u, i.e.
      //   s_max(v) = min_u max(s_x(u), s_y(u)).
      let sUpper = Number.POSITIVE_INFINITY
      if (useGrid) {
        const gx = Math.floor(center.x / cellSize)
        const gy = Math.floor(center.y / cellSize)
        outer: for (let dgx = -1; dgx <= 1; dgx++) {
          for (let dgy = -1; dgy <= 1; dgy++) {
            const bucket = grid.get(cellKey(gx + dgx, gy + dgy))
            if (!bucket) continue
            for (const u of bucket) {
              const dx = Math.abs(center.x - u.cx)
              const dy = Math.abs(center.y - u.cy)
              const slackX = dx - margin - u.halfWInflated - eps
              const slackY = dy - margin - u.halfHInflated - eps
              const sx = halfW > eps ? slackX / halfW : (slackX > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY)
              const sy = halfH > eps ? slackY / halfH : (slackY > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY)
              const sBound = Math.max(sx, sy)
              if (sBound < sUpper) sUpper = sBound
              if (sUpper < MIN_SCALE) break outer
            }
          }
        }
      } else {
        for (const u of acceptedInfo) {
          const dx = Math.abs(center.x - u.cx)
          const dy = Math.abs(center.y - u.cy)
          const slackX = dx - margin - u.halfWInflated - eps
          const slackY = dy - margin - u.halfHInflated - eps
          const sx = halfW > eps ? slackX / halfW : (slackX > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY)
          const sy = halfH > eps ? slackY / halfH : (slackY > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY)
          const sBound = Math.max(sx, sy)
          if (sBound < sUpper) sUpper = sBound
          if (sUpper < MIN_SCALE) break
        }
      }
      if (sUpper < MIN_SCALE) continue
      const chosen = Math.min(maxScale, sUpper)
      const info: AcceptedInfo = {
        cx: center.x,
        cy: center.y,
        halfWInflated: w0 * chosen / 2 + margin,
        halfHInflated: h0 * chosen / 2 + margin,
      }
      acceptedInfo.push(info)
      if (useGrid) {
        const gx = Math.floor(center.x / cellSize)
        const gy = Math.floor(center.y / cellSize)
        const key = cellKey(gx, gy)
        let bucket = grid.get(key)
        if (!bucket) {
          bucket = []
          grid.set(key, bucket)
        }
        bucket.push(info)
      }
      nodes.add(n)
      scales.set(n, chosen)
      if (chosen < maxScale) maxScale = chosen
    }
    return {nodes, scales}
  }

  /** Restrict a level's tile contents to the given active node set. Edges/labels
   *  whose source or target is outside the active set are removed; curve clips
   *  are cleared (they'll be rebuilt by clipEdgesIntoLevel). */
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

  /** Sum of entityCount across every tile on every level built so far. */
  private totalStoredElements(): number {
    let total = 0
    for (const level of this.levels) {
      for (const tile of level.values()) total += tile.entityCount
    }
    return total
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

  /** Clip-from-scratch path used after each per-level rerouting (sleeve and
   *  spline). Levels 0..z are rebuilt: each active edge's rerouted curve is
   *  first clipped against `topLevelTileRect` (the synthetic parent), seeded
   *  into the level-0 root tile, and then split top-down by the existing
   *  2-midline subdivision into all descendant tiles down to level z. The
   *  initial clip against `topLevelTileRect` restores the build-phase
   *  invariant `clip ⊆ parentRect`, which sleeve-routed curves around pumped
   *  landmarks may legitimately violate. */
  private clipEdgesIntoLevel(z: number, activeNodes: Set<Node>) {
    // Reset curve clips and arrowheads on every existing tile at levels 0..z;
    // we will repopulate them top-down below. Nodes and labels were already
    // filtered to the active set (sleeve path via applyActiveSetToLevel;
    // spline path via filterOutEntities) and do not depend on the rerouted
    // curves.
    for (let i = 0; i <= z; i++) {
      for (const t of this.levels[i].values()) {
        t.initCurveClips()
        t.arrowheads = []
      }
    }
    // Seed level-0 root tile(s) with the rerouted edges, clipped to the root
    // rect so out-of-world fragments never reach the children.
    for (const t of this.levels[0].values()) {
      this.seedRootTileWithRerouted(t, activeNodes)
    }
    // Top-down split: at each level, distribute every parent tile's clips and
    // arrowheads into its 4 children using the existing 2-midline machinery.
    for (let i = 1; i <= z; i++) {
      for (const [key, tile] of this.levels[i - 1].keyValues()) {
        this.splitTileClipsIntoChildren(key, i, tile)
      }
      this.removeEmptyTiles(i)
    }
  }

  /** Adds the active edges' rerouted curves and arrowheads to `rootTile`,
   *  clipping each segment to `rootTile.rect` so pieces extending past the
   *  world rect (sleeve routing around pumped landmarks) are dropped. */
  private seedRootTileWithRerouted(rootTile: Tile, activeNodes: Set<Node>) {
    for (const geomEdge of this.geomGraph.deepEdges) {
      if (!edgeNodesBelongToSet(geomEdge.edge, activeNodes)) continue
      const c = geomEdge.curve
      if (c == null) continue
      if (c instanceof Curve) {
        for (const seg of c.segs) this.addClippedSegmentToRootTile(seg, geomEdge.edge, rootTile)
      } else {
        this.addClippedSegmentToRootTile(c, geomEdge.edge, rootTile)
      }
      if (geomEdge.sourceArrowhead) {
        this.maybeAddArrowheadToTile(
          {edge: geomEdge.edge, tip: geomEdge.sourceArrowhead.tipPosition, base: c.start},
          rootTile,
        )
      }
      if (geomEdge.targetArrowhead) {
        this.maybeAddArrowheadToTile(
          {edge: geomEdge.edge, tip: geomEdge.targetArrowhead.tipPosition, base: c.end},
          rootTile,
        )
      }
    }
  }

  /** Pushes (curve, startPar, endPar) sub-intervals of `seg` that lie inside
   *  `tile.rect` as `CurveClip`s on `tile`. If `seg` is fully inside, a single
   *  clip is added; if it crosses the rect perimeter, only the inside pieces
   *  are kept. */
  private addClippedSegmentToRootTile(seg: ICurve, edge: Edge, tile: Tile) {
    const rect = tile.rect
    if (rect.containsRectWithPadding(seg.boundingBox, 1)) {
      tile.addCurveClip({curve: seg, edges: [edge], startPar: seg.parStart, endPar: seg.parEnd})
      return
    }
    const xs = Curve.getAllIntersections(seg, rect.perimeter(), true)
    if (xs.length === 0) {
      if (rect.contains(seg.start)) {
        tile.addCurveClip({curve: seg, edges: [edge], startPar: seg.parStart, endPar: seg.parEnd})
      }
      return
    }
    const eps = GeomConstants.distanceEpsilon
    const params: number[] = [seg.parStart]
    xs.sort((a, b) => a.par0 - b.par0)
    for (const x of xs) {
      const last = params[params.length - 1]
      if (x.par0 > last + eps && x.par0 < seg.parEnd - eps) params.push(x.par0)
    }
    params.push(seg.parEnd)
    for (let i = 0; i < params.length - 1; i++) {
      const a = params[i]
      const b = params[i + 1]
      if (b - a < eps) continue
      const p = seg.value(0.5 * (a + b))
      if (rect.contains(p)) tile.addCurveClip({curve: seg, edges: [edge], startPar: a, endPar: b})
    }
  }

  /** Adds `arrow` to `tile.arrowheads` if its bounding box (widened by the
   *  standard rotation-derived offset) intersects `tile.rect`. */
  private maybeAddArrowheadToTile(arrow: ArrowHeadData, tile: Tile) {
    const arrowheadBox = Rectangle.mkPP(arrow.base, arrow.tip)
    const d = arrow.tip.sub(arrow.base).div(3)
    const dRotated = d.rotate90Cw()
    arrowheadBox.add(arrow.base.add(dRotated))
    arrowheadBox.add(arrow.base.sub(dRotated))
    if (arrowheadBox.intersects(tile.rect)) tile.arrowheads.push(arrow)
  }

  /** Distributes `parentTile`'s curveClips and arrowheads into its 4 children
   *  at `childLevel`. CurveClips are split along the parent's two midlines and
   *  routed by midpoint side test (the same algorithm used by the build path's
   *  `subdivideWithCachedClipsAboveTile`). Arrowheads go to every child whose
   *  rect intersects the arrowhead's bounding box. Children are created on
   *  demand. Existing children's nodes/labels (already populated by the build
   *  phase) are left untouched; only their curveClips/arrowheads were cleared
   *  by the caller. */
  private splitTileClipsIntoChildren(parentKey: IntPair, childLevel: number, parentTile: Tile) {
    const {w, h} = this.getWHOnLevel(childLevel)
    const levelTiles = this.levels[childLevel]
    const xp = parentKey.x
    const yp = parentKey.y
    const left = this.topLevelTileRect.left + xp * w * 2
    const bottom = this.topLevelTileRect.bottom + yp * h * 2
    const keys = new Array<IntPair>(4)
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) keys[i * 2 + j] = new IntPair(xp * 2 + i, yp * 2 + j)

    const horizontalMiddleLine = new LineSegment(left, bottom + h, left + 2 * w, bottom + h)
    const verticalMiddleLine = new LineSegment(left + w, bottom, left + w, bottom + 2 * h)

    const ensureChild = (k: number): Tile => {
      let tile = levelTiles.getI(keys[k])
      if (!tile) {
        const i = k >> 1
        const j = k & 1
        const l = left + i * w
        const b = bottom + j * h
        tile = new Tile(new Rectangle({left: l, bottom: b, top: b + h, right: l + w}))
        levelTiles.setPair(keys[k], tile)
      }
      return tile
    }

    for (const clip of parentTile.curveClips) {
      const cs = clip.curve
      const xs = midlineSplit(cs, clip.startPar, clip.endPar, horizontalMiddleLine, verticalMiddleLine)
      for (let u = 0; u < xs.length - 1; u++) {
        const a = xs[u]
        const b = xs[u + 1]
        const p = cs.value(0.5 * (a + b))
        const i = p.x <= left + w ? 0 : 1
        const j = p.y <= bottom + h ? 0 : 1
        ensureChild(2 * i + j).addCurveClip({curve: cs, edges: clip.edges, startPar: a, endPar: b})
      }
    }

    for (const arrow of parentTile.arrowheads) {
      const arrowheadBox = Rectangle.mkPP(arrow.base, arrow.tip)
      const d = arrow.tip.sub(arrow.base).div(3)
      const dRotated = d.rotate90Cw()
      arrowheadBox.add(arrow.base.add(dRotated))
      arrowheadBox.add(arrow.base.sub(dRotated))
      for (let k = 0; k < 4; k++) {
        const i = k >> 1
        const j = k & 1
        const childRect = new Rectangle({
          left: left + i * w,
          bottom: bottom + j * h,
          right: left + (i + 1) * w,
          top: bottom + (j + 1) * h,
        })
        if (arrowheadBox.intersects(childRect)) ensureChild(k).arrowheads.push(arrow)
      }
    }

    function midlineSplit(seg: ICurve, start: number, end: number, hMid: LineSegment, vMid: LineSegment): number[] {
      const xs = Array.from(Curve.getAllIntersections(seg, hMid, true))
        .concat(Array.from(Curve.getAllIntersections(seg, vMid, true)))
        .map((x) => x.par0)
      xs.sort((a, b) => a - b)
      return [start].concat(xs.filter((x) => x >= start && x <= end)).concat(end)
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
        for (const edge of clip.edges) {
          const arr = getCreateEntityDataArray(edge)
          arr.push({tile: tile, data: clip})
        }
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

  private subdivideLevel(z: number, baseElements: number, maxElements: number): {stop: boolean; aborted: boolean} {
    console.log('subdivideLevel', z)
    const tilesInRow = Math.pow(2, z)
    this.levels[z] = new IntPairMap<Tile>()
    /** the width and the height of z-th level tile */
    const subRes = this.subdivideTilesOnLevel(z, baseElements, maxElements)
    if (subRes.aborted) {
      return {stop: true, aborted: true}
    }
    if (subRes.allTilesAreSmall) {
      console.log('done subdividing at level', z, 'because each tile contains less than', this.tileCapacity)
      return {stop: true, aborted: false}
    }
    const {w, h} = this.getWHOnLevel(z)

    if (w <= this.minTileSize.width && h <= this.minTileSize.height) {
      console.log('done subdividing at level', z, ' because of tile size = ', w, h, 'is less than ', this.minTileSize)
      return {stop: true, aborted: false}
    }
    return {stop: false, aborted: false}
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

  private subdivideTilesOnLevel(z: number, baseElements: number, maxElements: number): {allTilesAreSmall: boolean; aborted: boolean} {
    let allTilesAreSmall = true
    let levelElements = 0

    for (const [key, tile] of this.levels[z - 1].keyValues()) {
      const res = this.subdivideTile(key, z, tile)
      allTilesAreSmall &&= res.allSmall
      levelElements += res.addedElements
      if (baseElements + levelElements > maxElements) {
        console.log(
          'aborting level',
          z,
          'mid-build: total elements would exceed budget at',
          baseElements + levelElements,
          '>',
          maxElements,
        )
        return {allTilesAreSmall, aborted: true}
      }
    }
    this.removeEmptyTiles(z)
    console.log('generated', this.levels[z].size, 'tiles')
    return {allTilesAreSmall, aborted: false}
  }

  private subdivideTile(
    /** the tile key */
    key: IntPair,
    z: number, // the level above the lowerTile level
    /** this is the tile we are subdividing */
    lowerTile: Tile,
  ): {count: number; allSmall: boolean; addedElements: number} {
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

    this.generateSubtilesWithoutTileClips(left, w, bottom, h, keys, lowerTile, z)
    const horizontalMiddleLine = new LineSegment(left, bottom + h, left + 2 * w, bottom + h)
    const verticalMiddleLine = new LineSegment(left + w, bottom, left + w, bottom + 2 * h)
    subdivideWithCachedClipsAboveTile()
    let r = 0
    let allSmall = true
    let addedElements = 0
    for (const key of keys) {
      const tile = levelTiles.get(key.x, key.y)
      if (tile == null) continue
      r++
      addedElements += tile.entityCount
      if (tile.entityCount > this.tileCapacity) {
        allSmall = false
      }
    }
    return {count: r, allSmall: allSmall, addedElements}

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
          tile.addCurveClip({curve: cs, edges: clip.edges, startPar: xs[0], endPar: xs[1]})
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
            tile.addCurveClip({curve: cs, edges: clip.edges, startPar: xs[u], endPar: xs[u + 1]})
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
