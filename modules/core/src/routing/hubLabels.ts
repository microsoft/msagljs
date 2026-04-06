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
 *   - Bootstrap with already-computed labels (Section 5.2)
 *   - Store labels sorted by hub index for O(|L|) merge-sweep queries
 *   - Store parent pointers for path (sleeve) recovery
 */
import {ContractionHierarchy} from './contractionHierarchy'
import {CdtTriangle} from './ConstrainedDelaunayTriangulation/CdtTriangle'
import {CdtEdge} from './ConstrainedDelaunayTriangulation/CdtEdge'

// ── tiny min-heap (inlined for performance) ─────────────────────────
type QEntry = {g: number; node: number; seq: number}

function heapPush(heap: QEntry[], item: QEntry) {
  heap.push(item)
  let i = heap.length - 1
  while (i > 0) {
    const p = (i - 1) >> 1
    if (heap[p].g < item.g || (heap[p].g === item.g && heap[p].seq < item.seq)) break
    heap[i] = heap[p]
    heap[p] = item
    i = p
  }
}

function heapPop(heap: QEntry[]): QEntry {
  const top = heap[0]
  const last = heap.pop()!
  if (heap.length > 0) {
    heap[0] = last
    let i = 0
    for (;;) {
      let s = i
      const l = 2 * i + 1,
        r = 2 * i + 2
      if (l < heap.length && (heap[l].g < heap[s].g || (heap[l].g === heap[s].g && heap[l].seq < heap[s].seq))) s = l
      if (r < heap.length && (heap[r].g < heap[s].g || (heap[r].g === heap[s].g && heap[r].seq < heap[s].seq))) s = r
      if (s === i) break
      const tmp = heap[i]
      heap[i] = heap[s]
      heap[s] = tmp
      i = s
    }
  }
  return top
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
    // Process in descending rank order so that when we build L(v),
    // all higher-ranked vertices already have their strict labels.
    const order: number[] = new Array(n)
    for (let i = 0; i < n; i++) order[i] = i
    order.sort((a, b) => this.ch.nodes[b].rank - this.ch.nodes[a].rank)

    for (const v of order) {
      this.buildLabel(v)
    }
  }

  /** Build the hub label for a single vertex via pruned CH search */
  private buildLabel(v: number) {
    const ch = this.ch
    const dist = new Map<number, number>()
    const parent = new Map<number, number>()

    dist.set(v, 0)
    parent.set(v, -1)

    const heap: QEntry[] = []
    let seq = 0
    heapPush(heap, {g: 0, node: v, seq: seq++})

    // Collect settled (non-pruned) entries in visitation order
    const entries: {hub: number; dist: number; parent: number}[] = []

    while (heap.length > 0) {
      const cur = heapPop(heap)
      if (cur.g > (dist.get(cur.node) ?? Infinity)) continue

      const w = cur.node
      const dw = cur.g

      // Stall-on-demand (Section 5.1): check if any higher-ranked
      // neighbor u already has a shorter path v→u→w.
      let stalled = false
      for (const arc of ch.nodes[w].upArcs) {
        const du = dist.get(arc.target)
        if (du !== undefined && du + arc.weight < dw - 1e-10) {
          stalled = true
          break
        }
      }
      if (stalled) continue

      // Bootstrapping (Section 5.2): w has higher rank than v (since
      // we follow only upArcs), so L(w) is already a strict label.
      // Check if the CH search distance matches the HL distance.
      if (w !== v && this.hubIds[w]) {
        const hlDist = this.bootstrapQuery(entries, w)
        if (hlDist < dw - 1e-10) {
          continue // CH distance is not exact → prune
        }
      }

      entries.push({hub: w, dist: dw, parent: parent.get(w) ?? -1})

      // Relax upArcs
      for (const arc of ch.nodes[w].upArcs) {
        const newG = dw + arc.weight
        if (newG < (dist.get(arc.target) ?? Infinity)) {
          dist.set(arc.target, newG)
          parent.set(arc.target, w)
          heapPush(heap, {g: newG, node: arc.target, seq: seq++})
        }
      }
    }

    // Sort entries by hub index for merge-sweep queries
    entries.sort((a, b) => a.hub - b.hub)

    this.hubIds[v] = new Int32Array(entries.map((e) => e.hub))
    this.hubDists[v] = new Float64Array(entries.map((e) => e.dist))
    this.hubParents[v] = new Int32Array(entries.map((e) => e.parent))
  }

  /** Compute dist(v, w) using v's partially-built label and w's strict label.
   *  Uses binary search on w's sorted hubs for each entry in the partial label. */
  private bootstrapQuery(partialEntries: {hub: number; dist: number}[], w: number): number {
    const wHubs = this.hubIds[w]
    const wDists = this.hubDists[w]
    let best = Infinity

    for (const entry of partialEntries) {
      // Binary search for entry.hub in wHubs (sorted)
      let lo = 0,
        hi = wHubs.length - 1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (wHubs[mid] === entry.hub) {
          const d = entry.dist + wDists[mid]
          if (d < best) best = d
          break
        } else if (wHubs[mid] < entry.hub) {
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
    }
    return best
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
