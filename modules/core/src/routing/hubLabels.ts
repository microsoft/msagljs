/**
 * Hub-Based Labeling for shortest paths on CDT dual graphs.
 *
 * After Contraction Hierarchy (CH) preprocessing, computes compact hub
 * labels for each node so that shortest-path queries run in O(|L|)
 * time via a merge-sweep, where |L| is the average label size.
 *
 * Based on: Abraham et al., "A Hub-Based Labeling Algorithm for
 * Shortest Paths on Road Networks", MSR-TR-2010-165.
 *
 * Key ideas:
 *   - For each vertex v, run a forward CH search (upArcs only)
 *   - Apply stall-on-demand pruning (Section 5.1)
 *   - Store labels sorted by hub index for O(|L|) merge-sweep queries
 *   - Store parent pointers for path (sleeve) recovery
 */
import {ContractionHierarchy} from './contractionHierarchy'
import {CdtTriangle} from './ConstrainedDelaunayTriangulation/CdtTriangle'
import {CdtEdge} from './ConstrainedDelaunayTriangulation/CdtEdge'

// ── Flat min-heap on pre-allocated typed arrays (zero GC) ───────────

class FlatHeap {
  private g: Float64Array
  private node: Int32Array
  size = 0

  constructor(capacity: number) {
    this.g = new Float64Array(capacity)
    this.node = new Int32Array(capacity)
  }

  clear() {
    this.size = 0
  }

  push(g: number, node: number) {
    const hg = this.g, hn = this.node
    let i = this.size++
    hg[i] = g
    hn[i] = node
    while (i > 0) {
      const p = (i - 1) >> 1
      if (hg[p] < g || (hg[p] === g && hn[p] < node)) break
      // swap
      const tg = hg[i]; hg[i] = hg[p]; hg[p] = tg
      const tn = hn[i]; hn[i] = hn[p]; hn[p] = tn
      i = p
    }
  }

  popG(): number {
    return this.g[0]
  }
  popNode(): number {
    return this.node[0]
  }

  /** Remove the top element and re-heapify. Call popG/popNode first. */
  pop() {
    const hg = this.g, hn = this.node
    const last = --this.size
    if (last > 0) {
      hg[0] = hg[last]
      hn[0] = hn[last]
      let i = 0
      for (;;) {
        let s = i
        const l = 2 * i + 1, r = 2 * i + 2
        if (l < this.size && (hg[l] < hg[s] || (hg[l] === hg[s] && hn[l] < hn[s]))) s = l
        if (r < this.size && (hg[r] < hg[s] || (hg[r] === hg[s] && hn[r] < hn[s]))) s = r
        if (s === i) break
        const tg = hg[i]; hg[i] = hg[s]; hg[s] = tg
        const tn = hn[i]; hn[i] = hn[s]; hn[s] = tn
        i = s
      }
    }
  }
}

// ── HubLabels class ─────────────────────────────────────────────────

export class HubLabels {
  /** For each CH node: sorted arrays of hub indices, distances, and parents */
  private hubIds: Int32Array[]
  private hubDists: Float64Array[]
  private hubParents: Int32Array[] // parent in CH search tree (for path recovery)

  constructor(private ch: ContractionHierarchy) {
    const n = ch.nodes.length
    this.hubIds = new Array(n)
    this.hubDists = new Array(n)
    this.hubParents = new Array(n)
    this.buildAllLabels()
  }

  // ── label construction ──────────────────────────────────────────

  private buildAllLabels() {
    const n = this.ch.nodes.length
    const ch = this.ch

    // Process in descending rank order so that when we build L(v),
    // all higher-ranked vertices already have their strict labels.
    const order: number[] = new Array(n)
    for (let i = 0; i < n; i++) order[i] = i
    order.sort((a, b) => ch.nodes[b].rank - ch.nodes[a].rank)

    // Pre-allocate arrays reused across all label builds (avoids Map/GC overhead)
    const distArr = new Float64Array(n).fill(Infinity)
    const parentArr = new Int32Array(n).fill(-1)
    const inVisited = new Uint8Array(n)
    const visited: number[] = []

    // Temporary storage for entries before sorting
    const entryHub = new Int32Array(n)
    const entryDist = new Float64Array(n)
    const entryParent = new Int32Array(n)

    // Flat heap — pre-allocated, zero GC
    const heap = new FlatHeap(n * 4)

    for (const v of order) {
      // ── CH forward search from v (upArcs only) with stall-on-demand ──
      distArr[v] = 0
      parentArr[v] = -1
      inVisited[v] = 1
      visited.push(v)

      heap.clear()
      heap.push(0, v)

      let entryCount = 0

      while (heap.size > 0) {
        const dw = heap.popG()
        const w = heap.popNode()
        heap.pop()
        if (dw > distArr[w]) continue

        // Stall-on-demand (Section 5.1)
        let stalled = false
        const upArcs = ch.nodes[w].upArcs
        for (let i = 0; i < upArcs.length; i++) {
          const arc = upArcs[i]
          if (distArr[arc.target] + arc.weight < dw - 1e-10) {
            stalled = true
            break
          }
        }
        if (stalled) continue

        // Settle this node into the label
        entryHub[entryCount] = w
        entryDist[entryCount] = dw
        entryParent[entryCount] = parentArr[w]
        entryCount++

        // Relax upArcs
        for (let i = 0; i < upArcs.length; i++) {
          const arc = upArcs[i]
          const newG = dw + arc.weight
          if (newG < distArr[arc.target]) {
            if (!inVisited[arc.target]) {
              inVisited[arc.target] = 1
              visited.push(arc.target)
            }
            distArr[arc.target] = newG
            parentArr[arc.target] = w
            heap.push(newG, arc.target)
          }
        }
      }

      // ── Sort entries by hub index and store ──
      const indices = new Int32Array(entryCount)
      for (let i = 0; i < entryCount; i++) indices[i] = i
      indices.sort((a, b) => entryHub[a] - entryHub[b])

      const hubs = new Int32Array(entryCount)
      const dists = new Float64Array(entryCount)
      const parents = new Int32Array(entryCount)
      for (let i = 0; i < entryCount; i++) {
        const j = indices[i]
        hubs[i] = entryHub[j]
        dists[i] = entryDist[j]
        parents[i] = entryParent[j]
      }
      this.hubIds[v] = hubs
      this.hubDists[v] = dists
      this.hubParents[v] = parents

      // Reset reusable arrays
      for (const idx of visited) {
        distArr[idx] = Infinity
        parentArr[idx] = -1
        inVisited[idx] = 0
      }
      visited.length = 0
    }
  }

  // ── queries ─────────────────────────────────────────────────────

  /** Shortest distance between two CH node indices. O(|L|) merge-sweep. */
  query(s: number, t: number): number {
    if (s === t) return 0
    const sh = this.hubIds[s],
      sd = this.hubDists[s]
    const th = this.hubIds[t],
      td = this.hubDists[t]
    if (!sh || !th) return Infinity

    let is = 0,
      it = 0,
      best = Infinity
    while (is < sh.length && it < th.length) {
      const hs = sh[is],
        ht = th[it]
      if (hs === ht) {
        const d = sd[is] + td[it]
        if (d < best) best = d
        is++
        it++
      } else if (hs < ht) {
        is++
      } else {
        it++
      }
    }
    return best
  }

  /** Query returning the distance and the meeting hub node index. */
  queryWithHub(s: number, t: number): {dist: number; hub: number} | null {
    if (s === t) return {dist: 0, hub: s}
    const sh = this.hubIds[s],
      sd = this.hubDists[s]
    const th = this.hubIds[t],
      td = this.hubDists[t]
    if (!sh || !th) return null

    let is = 0,
      it = 0,
      best = Infinity,
      bestHub = -1
    while (is < sh.length && it < th.length) {
      const hs = sh[is],
        ht = th[it]
      if (hs === ht) {
        const d = sd[is] + td[it]
        if (d < best) {
          best = d
          bestHub = hs
        }
        is++
        it++
      } else if (hs < ht) {
        is++
      } else {
        it++
      }
    }
    return bestHub >= 0 ? {dist: best, hub: bestHub} : null
  }

  // ── path recovery ───────────────────────────────────────────────

  /** Trace the CH search-tree path from node v up to hub h. */
  private traceToHub(v: number, hub: number): number[] | null {
    const hubs = this.hubIds[v]
    const parents = this.hubParents[v]

    // Build parent map: hub → parent
    const parentMap = new Map<number, number>()
    for (let i = 0; i < hubs.length; i++) {
      parentMap.set(hubs[i], parents[i])
    }

    const path: number[] = [hub]
    let cur = hub
    const limit = hubs.length + 1
    for (let safety = 0; cur !== v && safety < limit; safety++) {
      const p = parentMap.get(cur)
      if (p === undefined || p < 0) {
        return cur === v ? path : null
      }
      path.push(p)
      cur = p
    }
    path.reverse()
    return path
  }

  /** Recover the CH-level path as a sequence of node indices: s → … → hub → … → t */
  findPath(s: number, t: number): number[] | null {
    if (s === t) return [s]
    const result = this.queryWithHub(s, t)
    if (!result || result.dist === Infinity) return null

    const hub = result.hub

    // Forward: s → … → hub (upward in CH)
    const fwdPath = this.traceToHub(s, hub)
    if (!fwdPath) return null

    // Backward: t → … → hub (upward in CH), then reversed to hub → … → t
    const bwdPath = this.traceToHub(t, hub)
    if (!bwdPath) return null
    bwdPath.reverse() // now hub → … → t

    // Merge (hub appears in both, deduplicate)
    return [...fwdPath, ...bwdPath.slice(1)]
  }

  /** Recover the sleeve (sequence of CdtTriangle + CdtEdge pairs) from s to t.
   *  Unpacks CH shortcuts recursively to get the original CDT edge sequence. */
  recoverSleeve(s: number, t: number): {source: CdtTriangle; edge: CdtEdge}[] | null {
    const path = this.findPath(s, t)
    if (!path) return null
    if (path.length < 2) return []

    const sleeve: {source: CdtTriangle; edge: CdtEdge}[] = []
    for (let i = 0; i < path.length - 1; i++) {
      this.ch.unpackArc(path[i], path[i + 1], sleeve)
    }
    return sleeve
  }

  // ── utilities ───────────────────────────────────────────────────

  /** Get the CH node index for a CDT triangle. */
  getIndex(t: CdtTriangle): number | undefined {
    return this.ch.getIndex(t)
  }

  /** Average label size (for diagnostics). */
  get averageLabelSize(): number {
    let total = 0
    for (const h of this.hubIds) {
      if (h) total += h.length
    }
    return total / this.hubIds.length
  }

  /** Maximum label size (for diagnostics). */
  get maxLabelSize(): number {
    let mx = 0
    for (const h of this.hubIds) {
      if (h && h.length > mx) mx = h.length
    }
    return mx
  }

  /** Number of nodes. */
  get nodeCount(): number {
    return this.hubIds.length
  }
}
