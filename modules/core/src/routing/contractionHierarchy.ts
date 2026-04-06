/**
 * Contraction Hierarchies on the CDT dual graph.
 *
 * Preprocesses the CDT dual (triangles as nodes, shared edges as arcs)
 * so that shortest-path queries run in O(log T) instead of O(T log T),
 * where T is the number of free-space triangles.
 *
 * Since CDT triangles have at most 3 neighbors, contracting a node
 * adds at most 3 shortcut edges — the graph stays sparse throughout.
 */
import {CdtTriangle} from './ConstrainedDelaunayTriangulation/CdtTriangle'
import {CdtEdge} from './ConstrainedDelaunayTriangulation/CdtEdge'
import {Cdt} from './ConstrainedDelaunayTriangulation/Cdt'
import {Point} from '../math/geometry/point'
import {Polyline} from '../math/geometry/polyline'

/** An arc in the CH graph — either an original CDT edge or a shortcut */
export type CHArc = {
  target: number // index of target node in the CH
  weight: number // Euclidean distance between centroids
  // For shortcuts: the sequence of CdtEdges that this arc represents
  // For original edges: a single CdtEdge
  midNode?: number // contracted node in the middle (for unpacking shortcuts)
  cdtEdge?: CdtEdge // original CDT edge (null for shortcuts)
}

/** A node in the CH graph, corresponding to a CDT triangle */
export type CHNode = {
  triangle: CdtTriangle
  centroid: Point
  rank: number // contraction order (higher = more important)
  upArcs: CHArc[] // arcs to higher-ranked neighbors
  downArcs: CHArc[] // arcs to lower-ranked neighbors (used during contraction only)
}

const emptyAllowed = new Set<Polyline>()

function triangleIsInsideObstacle(t: CdtTriangle): boolean {
  const o0 = t.Sites.item0.Owner as Polyline
  const o1 = t.Sites.item1.Owner as Polyline
  const o2 = t.Sites.item2.Owner as Polyline
  if (o0 == null || o1 == null || o2 == null) return false
  return o0 === o1 && o0 === o2
}

/** Default filter: include only free-space triangles (not inside any obstacle) */
export function freeSpaceFilter(t: CdtTriangle): boolean {
  return !triangleIsInsideObstacle(t)
}

export class ContractionHierarchy {
  nodes: CHNode[] = []
  private triToIndex = new Map<CdtTriangle, number>()

  /** Build the CH from a CDT.
   *  @param includeTriangle Optional filter — only triangles passing the filter are included.
   *    Defaults to including ALL triangles. Use `freeSpaceFilter` to exclude obstacle interiors. */
  constructor(cdt: Cdt, includeTriangle?: (t: CdtTriangle) => boolean) {
    this.buildGraph(cdt, includeTriangle)
    this.contract()
  }

  /** Build the initial dual graph from the CDT */
  private buildGraph(cdt: Cdt, includeTriangle?: (t: CdtTriangle) => boolean) {
    for (const t of cdt.GetTriangles()) {
      if (includeTriangle && !includeTriangle(t)) continue
      const idx = this.nodes.length
      const a = t.Sites.item0.point
      const b = t.Sites.item1.point
      const c = t.Sites.item2.point
      this.nodes.push({
        triangle: t,
        centroid: new Point((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3),
        rank: -1,
        upArcs: [],
        downArcs: [],
      })
      this.triToIndex.set(t, idx)
    }

    // Add edges between adjacent triangles (filtered by includeTriangle)
    const addedPairs = new Set<string>()
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i]
      for (const e of node.triangle.Edges) {
        const ot = e.GetOtherTriangle_T(node.triangle)
        if (ot == null) continue
        const j = this.triToIndex.get(ot)
        if (j === undefined) continue // obstacle-interior triangle
        const key = i < j ? `${i},${j}` : `${j},${i}`
        if (addedPairs.has(key)) continue
        addedPairs.add(key)
        const w = node.centroid.sub(this.nodes[j].centroid).length
        // Initially all arcs go into downArcs (will be reclassified after ranking)
        node.downArcs.push({target: j, weight: w, cdtEdge: e})
        this.nodes[j].downArcs.push({target: i, weight: w, cdtEdge: e})
      }
    }
  }

  /** Contract all nodes in order of importance.
   *  Uses edge-difference heuristic with witness searches to minimize shortcuts. */
  private contract() {
    const n = this.nodes.length
    if (n === 0) return

    const contracted = new Array<boolean>(n).fill(false)
    // Build adjacency with weights for fast lookup
    const adj = new Array<Map<number, number>>(n)
    for (let i = 0; i < n; i++) {
      adj[i] = new Map()
      for (const arc of this.nodes[i].downArcs) {
        const existing = adj[i].get(arc.target)
        if (existing === undefined || arc.weight < existing) {
          adj[i].set(arc.target, arc.weight)
        }
      }
    }

    // Edge difference priority: shortcuts_added - edges_removed
    function edgeDiff(node: number): number {
      const neighbors = Array.from(adj[node].keys()).filter(j => !contracted[j])
      const d = neighbors.length
      // Count needed shortcuts (pairs without shorter witness path)
      let shortcuts = 0
      for (let a = 0; a < neighbors.length; a++) {
        for (let b = a + 1; b < neighbors.length; b++) {
          const wA = adj[node].get(neighbors[a])!
          const wB = adj[node].get(neighbors[b])!
          const shortcutW = wA + wB
          const direct = adj[neighbors[a]].get(neighbors[b])
          if (direct !== undefined && direct <= shortcutW) continue
          shortcuts++
        }
      }
      return shortcuts - d
    }

    // Simple priority: process in order of edge difference (recompute lazily)
    const priority = new Array<number>(n)
    for (let i = 0; i < n; i++) priority[i] = edgeDiff(i)

    let rank = 0
    for (let iter = 0; iter < n; iter++) {
      // Find node with lowest priority among uncontracted
      let bestIdx = -1
      let bestPri = Infinity
      for (let i = 0; i < n; i++) {
        if (contracted[i]) continue
        if (priority[i] < bestPri) {
          bestPri = priority[i]
          bestIdx = i
        }
      }
      if (bestIdx < 0) break

      // Lazy update: recompute and check if still best
      const recomputed = edgeDiff(bestIdx)
      priority[bestIdx] = recomputed
      if (recomputed > bestPri) {
        iter-- // retry
        continue
      }

      // Contract this node
      this.nodes[bestIdx].rank = rank++
      contracted[bestIdx] = true

      const neighbors = Array.from(adj[bestIdx].keys()).filter(j => !contracted[j])
      for (let a = 0; a < neighbors.length; a++) {
        for (let b = a + 1; b < neighbors.length; b++) {
          const na = neighbors[a]
          const nb = neighbors[b]
          const wA = adj[bestIdx].get(na)!
          const wB = adj[bestIdx].get(nb)!
          const shortcutW = wA + wB

          const existing = adj[na].get(nb)
          if (existing !== undefined && existing <= shortcutW) continue

          // Add shortcut
          this.addArc(na, nb, shortcutW, bestIdx)
          adj[na].set(nb, shortcutW)
          adj[nb].set(na, shortcutW)
        }
      }

      // Remove contracted node from adjacency
      for (const nb of adj[bestIdx].keys()) {
        adj[nb].delete(bestIdx)
      }
    }

    // Reclassify arcs into upArcs (toward higher rank)
    for (let i = 0; i < n; i++) {
      const node = this.nodes[i]
      node.upArcs = []
      const newDown: CHArc[] = []
      for (const arc of node.downArcs) {
        if (this.nodes[arc.target].rank > node.rank) {
          node.upArcs.push(arc)
        } else {
          newDown.push(arc)
        }
      }
      node.downArcs = newDown
    }
  }

  /** Get weight of arc between two nodes, or -1 if no direct arc */
  private getWeight(from: number, to: number): number {
    for (const arc of this.nodes[from].downArcs) {
      if (arc.target === to) return arc.weight
    }
    return -1
  }

  /** Add a shortcut arc between two nodes */
  private addArc(a: number, b: number, weight: number, midNode: number) {
    this.nodes[a].downArcs.push({target: b, weight, midNode})
    this.nodes[b].downArcs.push({target: a, weight, midNode})
  }

  /** Get the CH node index for a CDT triangle */
  getIndex(t: CdtTriangle): number | undefined {
    return this.triToIndex.get(t)
  }

  /** Bidirectional Dijkstra query on the CH.
   *  Both forward and backward searches only follow upward arcs.
   *  Returns the shortest distance and the meeting node, or null if unreachable. */
  query(sourceIdx: number, targetIdx: number): {dist: number; meetNode: number; fwdParent: Map<number, number>; bwdParent: Map<number, number>} | null {
    if (sourceIdx === targetIdx) return {dist: 0, meetNode: sourceIdx, fwdParent: new Map(), bwdParent: new Map()}

    const fwdDist = new Map<number, number>()
    const bwdDist = new Map<number, number>()
    const fwdParent = new Map<number, number>() // node → parent node
    const bwdParent = new Map<number, number>()

    type QEntry = {g: number; node: number; seq: number}
    let seq = 0

    // Forward heap (from source, following upArcs)
    const fwdOpen: QEntry[] = []
    // Backward heap (from target, following upArcs)
    const bwdOpen: QEntry[] = []

    function heapPush(heap: QEntry[], item: QEntry) {
      heap.push(item)
      let i = heap.length - 1
      while (i > 0) {
        const p = (i - 1) >> 1
        if (heap[p].g < item.g || (heap[p].g === item.g && heap[p].seq < item.seq)) break
        heap[i] = heap[p]; heap[p] = item; i = p
      }
    }
    function heapPop(heap: QEntry[]): QEntry {
      const top = heap[0]; const last = heap.pop()!
      if (heap.length > 0) {
        heap[0] = last; let i = 0
        while (true) {
          let s = i; const l = 2*i+1, r = 2*i+2
          if (l < heap.length && (heap[l].g < heap[s].g || (heap[l].g === heap[s].g && heap[l].seq < heap[s].seq))) s = l
          if (r < heap.length && (heap[r].g < heap[s].g || (heap[r].g === heap[s].g && heap[r].seq < heap[s].seq))) s = r
          if (s === i) break
          const tmp = heap[i]; heap[i] = heap[s]; heap[s] = tmp; i = s
        }
      }
      return top
    }

    fwdDist.set(sourceIdx, 0)
    bwdDist.set(targetIdx, 0)
    heapPush(fwdOpen, {g: 0, node: sourceIdx, seq: seq++})
    heapPush(bwdOpen, {g: 0, node: targetIdx, seq: seq++})

    let bestDist = Infinity
    let meetNode = -1

    // Alternating forward/backward search
    while (fwdOpen.length > 0 || bwdOpen.length > 0) {
      // Stop if both heaps' minimums exceed bestDist
      const fwdMin = fwdOpen.length > 0 ? fwdOpen[0].g : Infinity
      const bwdMin = bwdOpen.length > 0 ? bwdOpen[0].g : Infinity
      if (fwdMin >= bestDist && bwdMin >= bestDist) break

      // Expand forward
      if (fwdOpen.length > 0 && fwdMin <= bwdMin) {
        const cur = heapPop(fwdOpen)
        if (cur.g > (fwdDist.get(cur.node) ?? Infinity)) continue
        // Check if backward search reached this node
        const bwd = bwdDist.get(cur.node)
        if (bwd !== undefined && cur.g + bwd < bestDist) {
          bestDist = cur.g + bwd
          meetNode = cur.node
        }
        // Follow upArcs only
        for (const arc of this.nodes[cur.node].upArcs) {
          const newG = cur.g + arc.weight
          if (newG < (fwdDist.get(arc.target) ?? Infinity)) {
            fwdDist.set(arc.target, newG)
            fwdParent.set(arc.target, cur.node)
            heapPush(fwdOpen, {g: newG, node: arc.target, seq: seq++})
          }
        }
      } else if (bwdOpen.length > 0) {
        // Expand backward
        const cur = heapPop(bwdOpen)
        if (cur.g > (bwdDist.get(cur.node) ?? Infinity)) continue
        const fwd = fwdDist.get(cur.node)
        if (fwd !== undefined && cur.g + fwd < bestDist) {
          bestDist = cur.g + fwd
          meetNode = cur.node
        }
        for (const arc of this.nodes[cur.node].upArcs) {
          const newG = cur.g + arc.weight
          if (newG < (bwdDist.get(arc.target) ?? Infinity)) {
            bwdDist.set(arc.target, newG)
            bwdParent.set(arc.target, cur.node)
            heapPush(bwdOpen, {g: newG, node: arc.target, seq: seq++})
          }
        }
      }
    }

    if (meetNode < 0) return null
    return {dist: bestDist, meetNode, fwdParent, bwdParent}
  }

  /** Unpack the CH path into a sequence of CDT triangle indices */
  unpackPath(sourceIdx: number, targetIdx: number, fwdParent: Map<number, number>, bwdParent: Map<number, number>, meetNode: number): number[] {
    // Forward path: source → meetNode
    const fwdPath: number[] = []
    for (let n = meetNode; n !== sourceIdx && fwdParent.has(n); n = fwdParent.get(n)!) {
      fwdPath.push(n)
    }
    fwdPath.push(sourceIdx)
    fwdPath.reverse()

    // Backward path: meetNode → target
    const bwdPath: number[] = []
    for (let n = meetNode; n !== targetIdx && bwdParent.has(n); n = bwdParent.get(n)!) {
      // skip meetNode (already in fwdPath)
    }
    // Actually, trace from target back to meetNode
    const bwdTrace: number[] = []
    for (let n = targetIdx; n !== meetNode && bwdParent.has(n); n = bwdParent.get(n)!) {
      bwdTrace.push(n)
    }
    bwdTrace.reverse()

    return [...fwdPath, ...bwdTrace]
  }

  /** Recover the sleeve (sequence of FrontEdges) from a CH path.
   *  Unpacks shortcuts recursively to get the original CDT edge sequence. */
  recoverSleeve(sourceIdx: number, targetIdx: number): {source: CdtTriangle; edge: CdtEdge}[] | null {
    const result = this.query(sourceIdx, targetIdx)
    if (!result) return null

    // Get the high-level path through CH nodes
    const chPath = this.unpackPath(sourceIdx, targetIdx, result.fwdParent, result.bwdParent, result.meetNode)

    // Now we need to unpack each consecutive pair in chPath into the original CDT edges.
    // For each pair (a, b), find the arc between them and recursively unpack shortcuts.
    const sleeve: {source: CdtTriangle; edge: CdtEdge}[] = []
    for (let i = 0; i < chPath.length - 1; i++) {
      this.unpackArc(chPath[i], chPath[i + 1], sleeve)
    }
    return sleeve
  }

  /** Recursively unpack an arc between two CH nodes into original CDT edges */
  unpackArc(from: number, to: number, result: {source: CdtTriangle; edge: CdtEdge}[]) {
    // Find the arc
    const arc = this.findArc(from, to)
    if (!arc) return

    if (arc.cdtEdge) {
      // Original edge — add directly
      result.push({source: this.nodes[from].triangle, edge: arc.cdtEdge})
    } else if (arc.midNode !== undefined) {
      // Shortcut — unpack recursively: from→mid, mid→to
      this.unpackArc(from, arc.midNode, result)
      this.unpackArc(arc.midNode, to, result)
    }
  }

  /** Find arc from node a to node b in either upArcs or downArcs */
  findArc(a: number, b: number): CHArc | undefined {
    for (const arc of this.nodes[a].upArcs) {
      if (arc.target === b) return arc
    }
    for (const arc of this.nodes[a].downArcs) {
      if (arc.target === b) return arc
    }
    // Also check b→a (arcs might be stored on the other end)
    for (const arc of this.nodes[b].upArcs) {
      if (arc.target === a) return arc
    }
    for (const arc of this.nodes[b].downArcs) {
      if (arc.target === a) return arc
    }
    return undefined
  }
}
