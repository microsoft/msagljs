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

/** Computes the bounding box of curve's value over parameter range [start, end]
 *  WITHOUT allocating a trimmed curve. For composite Curves consisting of
 *  LineSegments (typical for corridor-routed edges) this is fully allocation-free
 *  for fully-contained inner segments (reuses cached seg.boundingBox) and costs
 *  only a couple of Point/Rectangle allocs for the two partial end segments.
 *  Falls back to seg.trim(...).boundingBox for Bezier/Ellipse partial sub-ranges,
 *  where an analytic cheap bbox isn't easy — but avoids wrapping in a new Curve. */
function paramRangeBBox(cs: ICurve, start: number, end: number): Rectangle {
  // Accumulate bbox as 4 numbers to avoid intermediate Rectangle.clone()/addRecSelf
  // allocations, then build one Rectangle at the end.
  let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY
  const eps = GeomConstants.distanceEpsilon

  function foldRange(seg: ICurve, s: number, e: number) {
    if (seg instanceof LineSegment) {
      // LineSegment.value(t) = start + (end - start)*t; inlined to avoid 2 Point allocs.
      const sx = seg.start.x, sy = seg.start.y
      const dx = seg.end.x - sx, dy = seg.end.y - sy
      const ax = sx + dx * s, ay = sy + dy * s
      const bx = sx + dx * e, by = sy + dy * e
      if (ax < minX) minX = ax; if (ax > maxX) maxX = ax
      if (bx < minX) minX = bx; if (bx > maxX) maxX = bx
      if (ay < minY) minY = ay; if (ay > maxY) maxY = ay
      if (by < minY) minY = by; if (by > maxY) maxY = by
      return
    }
    if (seg instanceof Curve) {
      if (s <= seg.parStart + eps && e >= seg.parEnd - eps) {
        foldRect(seg.boundingBox); return
      }
      const si = seg.getSegIndexParam(s)
      const ei = seg.getSegIndexParam(e)
      if (si.segIndex === ei.segIndex) {
        foldRange(seg.segs[si.segIndex], si.par, ei.par); return
      }
      const sSeg = seg.segs[si.segIndex]
      const eSeg = seg.segs[ei.segIndex]
      foldRange(sSeg, si.par, sSeg.parEnd)
      for (let i = si.segIndex + 1; i < ei.segIndex; i++) foldRect(seg.segs[i].boundingBox)
      foldRange(eSeg, eSeg.parStart, ei.par)
      return
    }
    // Bezier/Ellipse/Polyline: full range → cached bbox; sub-range → trim fallback
    if (s <= seg.parStart + eps && e >= seg.parEnd - eps) {
      foldRect(seg.boundingBox); return
    }
    foldRect(seg.trim(s, e).boundingBox)
  }

  function foldRect(r: Rectangle) {
    if (r.left < minX) minX = r.left
    if (r.right > maxX) maxX = r.right
    if (r.bottom < minY) minY = r.bottom
    if (r.top > maxY) maxY = r.top
  }

  foldRange(cs, start, end)
  return new Rectangle({left: minX, right: maxX, bottom: minY, top: maxY})
}
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
export type CurveClip = {curve: ICurve; edge?: Edge; startPar: number; endPar: number; bbox?: Rectangle}
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
  /** the maximal number visual elements vizible in a tile.
   * Auto-scaled by buildUpToLevel() for large graphs to bound memory. */
  private tileCapacity = 500 // in the number of elements
  /** the tiles of level z is represented by levels[z] */
  private levels: IntPairMap<Tile>[] = []

  private pageRank: Map<Node, number> | null

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
      const c = geomEdge.curve
      // Store one CurveClip per edge regardless of whether the curve is a
      // composite Curve. Composite curves are expanded to per-segment draws
      // lazily in the renderer (only for visible tiles).
      topLevelTile.addElement({edge: e, curve: c, startPar: c.parStart, endPar: c.parEnd})
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
    // Memory guard for very large graphs. CurveClip count roughly doubles per
    // level, and an in-browser tab has a ~4GB V8 heap cap, so for dense graphs
    // we cap the number of tile levels and raise tileCapacity so subdivision
    // terminates earlier. Without this ca-HepPh (~237K edges) OOMs a 4GB tab
    // while building level 7/8 worth of curve clips.
    const edgeCount = this.geomGraph.graph.deepEdgesCount
    if (edgeCount > 200000) {
      this.tileCapacity = 2000
      if (z > 6) z = 6
    } else if (edgeCount > 50000) {
      this.tileCapacity = 1500
      if (z > 7) z = 7
    } else if (edgeCount > 10000) {
      this.tileCapacity = 1000
    }

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
        // Single-pass collection: avoids materializing Array.from(deepEdges)
        // (which is O(|E|) per level, up to 200K+ entries on ca-HepPh) just to
        // then filter it. Builds only the surviving-edges list directly.
        const activeEdges: GeomEdge[] = []
        for (const e of this.geomGraph.deepEdges) {
          if (edgeNodesBelongToSet(e.edge, activeNodes)) activeEdges.push(e)
        }
        if (activeEdges.length > 0) {
          // Snapshot current (finer-level) curves *before* rerouting mutates them.
          let prevRoutes: Map<GeomEdge, ICurve> | null = new Map<GeomEdge, ICurve>()
          for (const e of activeEdges) {
            if (e.curve) prevRoutes.set(e, e.curve)
          }
          const scaleMap = this.nodeScales[k]
          const nodeScale = (n: GeomNode) => scaleMap.get(n.node) ?? 1
          let activeGeomNodes: Set<GeomNode> | null = new Set<GeomNode>()
          for (const n of activeNodes) {
            const gn = GeomNode.getGeom(n)
            if (gn) activeGeomNodes.add(gn)
          }
          routeCorridorEdges(this.geomGraph, activeEdges, null, ers.Padding, prevRoutes, nodeScale, activeGeomNodes, extraObstaclePadding, `level-${k}`)
          // Release intermediate per-iteration structures before regenerate to
          // reduce peak heap during the subsequent tile subdivision phase.
          prevRoutes.clear()
          prevRoutes = null
          activeGeomNodes.clear()
          activeGeomNodes = null
          activeEdges.length = 0
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
    // pagerank map is no longer needed after ranks are computed; on 200K+ node
    // graphs freeing it shaves tens of MB before tile subdivision's peak.
    this.pageRank = null
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
    // Parallel number arrays instead of Rectangle[] — cuts heap pressure on dense
    // graphs where topK is O(10^5) and the per-scale retry allocates a Rectangle
    // + Size each iteration.
    const acceptedL: number[] = []
    const acceptedR: number[] = []
    const acceptedB: number[] = []
    const acceptedT: number[] = []
    const nodes = new Set<Node>()
    const scales = new Map<Node, number>()
    const STEP = 0.85
    const MIN_SCALE = 1
    let maxScale = desiredMax
    const scaleSequence: number[] = []
    for (let ii = 0; ii < k && ii < sorted.length; ii++) {
      const n = sorted[ii]
      const gn = GeomNode.getGeom(n)
      if (!gn) continue
      const bb = gn.boundingBox
      const cx = (bb.left + bb.right) / 2
      const cy = (bb.bottom + bb.top) / 2
      const w0 = bb.width
      const h0 = bb.height
      let chosen = -1
      scaleSequence.length = 0
      for (let s = maxScale; s > MIN_SCALE; s *= STEP) scaleSequence.push(s)
      scaleSequence.push(MIN_SCALE)
      for (const s of scaleSequence) {
        const hw = (w0 * s) / 2 + margin
        const hh = (h0 * s) / 2 + margin
        const bl = cx - hw, br = cx + hw, bb_ = cy - hh, bt = cy + hh
        let overlaps = false
        for (let ai = 0; ai < acceptedL.length; ai++) {
          if (acceptedR[ai] < bl || acceptedL[ai] > br) continue
          if (acceptedT[ai] < bb_ || acceptedB[ai] > bt) continue
          overlaps = true
          break
        }
        if (!overlaps) { chosen = s; break }
      }
      if (chosen < 0) continue
      const hw = (w0 * chosen) / 2 + margin
      const hh = (h0 * chosen) / 2 + margin
      acceptedL.push(cx - hw)
      acceptedR.push(cx + hw)
      acceptedB.push(cy - hh)
      acceptedT.push(cy + hh)
      nodes.add(n)
      scales.set(n, chosen)
      if (chosen < maxScale) maxScale = chosen
    }
    return {nodes, scales}
  }

  /** Restrict a level's tile contents to the given active node set. Edges/labels
   *  whose source or target is outside the active set are removed; curve clips
   *  are cleared (they'll be rebuilt by regenerateCurveClipsUpToLevel).
   *  In-place filtering (not `.filter()`) keeps us from allocating 3 throwaway
   *  arrays per tile per level, which matters on dense graphs. */
  private applyActiveSetToLevel(levelIdx: number, activeNodes: Set<Node>) {
    for (const tile of this.levels[levelIdx].values()) {
      // nodes
      let w = 0
      const nodes = tile.nodes
      for (let r = 0; r < nodes.length; r++) {
        const gn = nodes[r]
        if (activeNodes.has(gn.node)) nodes[w++] = gn
      }
      nodes.length = w

      // labels
      w = 0
      const labels = tile.labels
      for (let r = 0; r < labels.length; r++) {
        const lab = labels[r]
        const parent = lab.parent
        let keep = true
        if (parent instanceof GeomEdge) {
          keep = activeNodes.has(parent.edge.source) && activeNodes.has(parent.edge.target)
        }
        if (keep) labels[w++] = lab
      }
      labels.length = w

      // arrowheads
      w = 0
      const arrows = tile.arrowheads
      for (let r = 0; r < arrows.length; r++) {
        const a = arrows[r]
        if (activeNodes.has(a.edge.source) && activeNodes.has(a.edge.target)) arrows[w++] = a
      }
      arrows.length = w

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
      // Store whole curve as one clip; segment expansion is lazy at render time.
      t.addElement({edge: geomEdge.edge, curve: geomEdge.curve, startPar: geomEdge.curve.parStart, endPar: geomEdge.curve.parEnd})
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
    // Collect (x, y) pairs as two parallel number arrays to avoid IntPair allocs.
    const delX: number[] = []
    const delY: number[] = []
    level.forEach((x, y, t) => {
      if (t.isEmpty()) {
        delX.push(x)
        delY.push(y)
      }
    })
    for (let i2 = 0; i2 < delX.length; i2++) {
      level.delete(delX[i2], delY[i2])
    }
  }

  regenerateCurveClipsWhenPreviosLayerIsDone(z: number) {
    this.levels[z - 1].forEach((x, y, tile) => {
      this.subdivideTile(x, y, z, tile, /** for regenerate */ true)
    })
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
    let allTilesAreSmall = true
    this.levels[z - 1].forEach((x, y, tile) => {
      const res = this.subdivideTile(x, y, z, tile, false)
      allTilesAreSmall &&= res.allSmall
    })
    this.removeEmptyTiles(z)
    console.log('generated', this.levels[z].size, 'tiles')
    return allTilesAreSmall
  }

  private subdivideTile(
    xp: number,
    yp: number,
    z: number, // the level above the lowerTile level
    /** this is the tile we are subdividing */
    lowerTile: Tile,
    regenerate: boolean,
  ): {count: number; allSmall: boolean} {
    const {w, h} = this.getWHOnLevel(z)
    /** this is the map we collect new tiles to */
    const levelTiles = this.levels[z]

    const left = this.topLevelTileRect.left + xp * w * 2
    const bottom = this.topLevelTileRect.bottom + yp * h * 2
    /** child tile keys (x0,y0,x1,y1,...) — flat numbers to avoid IntPair allocations */
    const childX0 = xp * 2
    const childY0 = yp * 2

    if (!regenerate) {
      this.generateSubtilesWithoutTileClips(left, w, bottom, h, childX0, childY0, lowerTile, z)
    } else {
      // regenerate mode: re-propagate arrowheads from the (updated) upper tile into
      // existing subtiles so they stay consistent with the rerouted curves.
      // Precompute arrowhead bboxes once per arrowhead (not per subtile).
      // The box is the base-tip segment inflated by ±d⊥/3, so it covers the
      // short triangular head. We keep it as 4 numbers to skip Point/Rectangle
      // allocations in the hot inner loop.
      const nA = lowerTile.arrowheads.length
      let aMinX: Float64Array | null = null
      let aMinY: Float64Array | null = null
      let aMaxX: Float64Array | null = null
      let aMaxY: Float64Array | null = null
      if (nA > 0) {
        aMinX = new Float64Array(nA)
        aMinY = new Float64Array(nA)
        aMaxX = new Float64Array(nA)
        aMaxY = new Float64Array(nA)
        for (let ai = 0; ai < nA; ai++) {
          const arrowhead = lowerTile.arrowheads[ai]
          const bx = arrowhead.base.x, by = arrowhead.base.y
          const tx = arrowhead.tip.x, ty = arrowhead.tip.y
          // d = (tip - base) / 3; d⊥ (rotate90Cw) = (d.y, -d.x)
          const dxp = (ty - by) / 3
          const dyp = -(tx - bx) / 3
          // 4 corners: base ± d⊥, plus tip for the far end of the box
          const p1x = bx + dxp, p1y = by + dyp
          const p2x = bx - dxp, p2y = by - dyp
          let lo_x = bx < tx ? bx : tx
          let hi_x = bx < tx ? tx : bx
          let lo_y = by < ty ? by : ty
          let hi_y = by < ty ? ty : by
          if (p1x < lo_x) lo_x = p1x; else if (p1x > hi_x) hi_x = p1x
          if (p1y < lo_y) lo_y = p1y; else if (p1y > hi_y) hi_y = p1y
          if (p2x < lo_x) lo_x = p2x; else if (p2x > hi_x) hi_x = p2x
          if (p2y < lo_y) lo_y = p2y; else if (p2y > hi_y) hi_y = p2y
          aMinX[ai] = lo_x; aMaxX[ai] = hi_x
          aMinY[ai] = lo_y; aMaxY[ai] = hi_y
        }
      }
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const sub = levelTiles.get(childX0 + i, childY0 + j)
          if (sub == null) continue
          sub.arrowheads = []
          const subRect = sub.rect
          const sL = subRect.left, sR = subRect.right, sB = subRect.bottom, sT = subRect.top
          for (let ai = 0; ai < nA; ai++) {
            // bbox-bbox intersect: overlap in x AND y
            if (aMaxX[ai] < sL || aMinX[ai] > sR) continue
            if (aMaxY[ai] < sB || aMinY[ai] > sT) continue
            sub.arrowheads.push(lowerTile.arrowheads[ai])
          }
        }
    }
    const horizontalMiddleLine = new LineSegment(left, bottom + h, left + 2 * w, bottom + h)
    const verticalMiddleLine = new LineSegment(left + w, bottom, left + w, bottom + 2 * h)
    subdivideWithCachedClipsAboveTile()
    let r = 0
    let allSmall = true
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const tile = levelTiles.get(childX0 + i, childY0 + j)
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

      const midX = left + w
      const midY = bottom + h
      for (const clip of lowerTile.curveClips) {
        const cs = clip.curve
        const cb = getClipBBox(clip)
        // Fast path: if the clip's bounding box is entirely inside one of the four
        // child quadrants, it cannot cross the middle lines - put the parent clip
        // into that child as-is and skip the expensive parallelogram-based
        // intersection entirely. On dense graphs this is the dominant case and it
        // is what was causing the OOM: the old code called Curve.getAllIntersections
        // twice per clip per level regardless.
        if (cb.right <= midX || cb.left >= midX) {
          if (cb.top <= midY || cb.bottom >= midY) {
            const i = cb.right <= midX ? 0 : 1
            const j = cb.top <= midY ? 0 : 1
            const tx = childX0 + i
            const ty = childY0 + j
            let tile = levelTiles.get(tx, ty)
            if (!tile) {
              const l = left + i * w
              const b = bottom + j * h
              tile = new Tile(new Rectangle({left: l, bottom: b, top: b + h, right: l + w}))
              levelTiles.set(tx, ty, tile)
            }
            tile.addCurveClip(clip)
            continue
          }
        }
        // Slow path: the clip's bbox straddles at least one middle line.
        // Only ask for intersections with the lines it actually straddles.
        const xs = intersectWithMiddleLinesBBox(cs, clip.startPar, clip.endPar, cb, midX, midY)

        Assert.assert(xs.length >= 2)
        if (xs.length == 2) {
          const t = (xs[0] + xs[1]) / 2
          const p = cs.value(t)
          const i = p.x <= midX ? 0 : 1
          const j = p.y <= midY ? 0 : 1
          const tx = childX0 + i
          const ty = childY0 + j
          let tile = levelTiles.get(tx, ty)
          if (!tile) {
            const l = left + i * w
            const b = bottom + j * h
            tile = new Tile(new Rectangle({left: l, bottom: b, top: b + h, right: l + w}))
            levelTiles.set(tx, ty, tile)
          }
          // The child clip is identical to the parent clip (whole curve range lies in one
          // quadrant), so reuse the parent CurveClip instead of allocating a new one.
          // This removes a large per-level memory multiplier on dense graphs.
          tile.addCurveClip(clip)
        } else
          for (let u = 0; u < xs.length - 1; u++) {
            const t = (xs[u] + xs[u + 1]) / 2
            const p = cs.value(t)
            const i = p.x <= midX ? 0 : 1
            const j = p.y <= midY ? 0 : 1
            const tx = childX0 + i
            const ty = childY0 + j
            let tile = levelTiles.get(tx, ty)
            if (!tile) {
              const l = left + i * w
              const b = bottom + j * h
              tile = new Tile(new Rectangle({left: l, bottom: b, top: b + h, right: l + w}))
              levelTiles.set(tx, ty, tile)
            }
            tile.addCurveClip({curve: cs, edge: clip.edge, startPar: xs[u], endPar: xs[u + 1]})
          }
      }
    }

    function getClipBBox(clip: CurveClip): Rectangle {
      if (clip.bbox) return clip.bbox
      const cs = clip.curve
      if (clip.startPar <= cs.parStart + GeomConstants.distanceEpsilon && clip.endPar >= cs.parEnd - GeomConstants.distanceEpsilon) {
        return (clip.bbox = cs.boundingBox)
      }
      // Allocation-light bbox over a param sub-range. For LineSegment-based
      // polylines (corridor routing) this is Curve-allocation-free; for bezier
      // sub-ranges still falls back to trim, but that's the uncommon case.
      return (clip.bbox = paramRangeBBox(cs, clip.startPar, clip.endPar))
    }

    function intersectWithMiddleLinesBBox(
      seg: ICurve,
      start: number,
      end: number,
      cb: Rectangle,
      midX: number,
      midY: number,
    ): Array<number> {
      const crossesH = cb.top > midY && cb.bottom < midY
      const crossesV = cb.right > midX && cb.left < midX
      let xs: number[] = []
      if (crossesH) {
        for (const ix of Curve.getAllIntersections(seg, horizontalMiddleLine, true)) xs.push(ix.par0)
      }
      if (crossesV) {
        for (const ix of Curve.getAllIntersections(seg, verticalMiddleLine, true)) xs.push(ix.par0)
      }
      xs.sort((a, b) => a - b)
      const out: number[] = [start]
      for (const x of xs) if (x > start && x < end) out.push(x)
      out.push(end)
      return out
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
    childX0: number,
    childY0: number,
    upperTile: Tile,
    z: number,
  ) {
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
          this.levels[z].set(childX0 + i, childY0 + j, tile)
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
