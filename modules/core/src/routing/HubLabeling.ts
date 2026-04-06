/**
 * Hub-Based Labeling Algorithm for Shortest Paths
 *
 * Based on: Abraham, Delling, Goldberg, Werneck —
 * "A Hub-Based Labeling Algorithm for Shortest Paths on Road Networks"
 * (Microsoft Research Technical Report MSR-TR-2010-165)
 *
 * Preprocessing uses Contraction Hierarchies (CH) to build compact hub labels.
 * Queries merge sorted labels in O(|L|) time for distance, with shortcut
 * unpacking for path reconstruction.
 */

import {GenericBinaryHeapPriorityQueue} from '../structs/genericBinaryHeapPriorityQueue'
import {VisibilityGraph} from './visibility/VisibilityGraph'
import {VisibilityVertex} from './visibility/VisibilityVertex'

/** A single entry in a hub label: (hub vertex index, distance, parent index for path reconstruction) */
interface LabelEntry {
  hub: number
  distance: number
  parent: number // index of parent vertex in CH search tree (-1 for the root)
}

/** An edge in the CH-augmented adjacency list */
interface CHNeighbor {
  vertex: number
  length: number
  // for shortcuts: the contracted middle vertex (-1 for original edges)
  middle: number
}

export class HubLabeling {
  // Vertex indexing
  private vertices: VisibilityVertex[]
  private vertexIndex: Map<VisibilityVertex, number>

  // CH adjacency (undirected, includes shortcuts)
  private adj: CHNeighbor[][]

  // Contraction order: rank[i] = rank of vertex i, order[r] = vertex at rank r
  private ranks: Int32Array
  private order: Int32Array
  private levels: Int32Array
  private contracted: Uint8Array

  // Hub labels: labels[i] = sorted array of LabelEntry (sorted by hub index)
  private labels: LabelEntry[][]

  // For shortcut unpacking: key = "lo,hi" → middle vertex index
  private shortcutMiddle: Map<number, number>

  private n: number // vertex count

  constructor(visGraph: VisibilityGraph) {
    this.buildFromGraph(visGraph)
  }

  /** Query shortest path distance between two vertices. Returns Infinity if unreachable. */
  queryDistance(s: VisibilityVertex, t: VisibilityVertex): number {
    const si = this.vertexIndex.get(s)
    const ti = this.vertexIndex.get(t)
    if (si === undefined || ti === undefined) return Number.POSITIVE_INFINITY
    if (si === ti) return 0
    return this.queryDistByIndex(si, ti)
  }

  /** Query shortest path. Returns null if unreachable. */
  queryPath(s: VisibilityVertex, t: VisibilityVertex): VisibilityVertex[] | null {
    const si = this.vertexIndex.get(s)
    const ti = this.vertexIndex.get(t)
    if (si === undefined || ti === undefined) return null
    if (si === ti) return [s]
    return this.queryPathByIndex(si, ti)
  }

  // ─── Internal distance query via merge sweep (Section 4.2 of paper) ───

  private queryDistByIndex(si: number, ti: number): number {
    const ls = this.labels[si]
    const lt = this.labels[ti]
    let is_ = 0
    let it_ = 0
    let best = Number.POSITIVE_INFINITY
    while (is_ < ls.length && it_ < lt.length) {
      const hs = ls[is_].hub
      const ht = lt[it_].hub
      if (hs === ht) {
        const d = ls[is_].distance + lt[it_].distance
        if (d < best) best = d
        is_++
        it_++
      } else if (hs < ht) {
        is_++
      } else {
        it_++
      }
    }
    return best
  }

  // ─── Path query: find meeting hub, trace paths, unpack shortcuts ───

  private queryPathByIndex(si: number, ti: number): VisibilityVertex[] | null {
    const ls = this.labels[si]
    const lt = this.labels[ti]
    let is_ = 0
    let it_ = 0
    let bestDist = Number.POSITIVE_INFINITY
    let bestHub = -1
    let bestIs = -1
    let bestIt = -1

    while (is_ < ls.length && it_ < lt.length) {
      const hs = ls[is_].hub
      const ht = lt[it_].hub
      if (hs === ht) {
        const d = ls[is_].distance + lt[it_].distance
        if (d < bestDist) {
          bestDist = d
          bestHub = hs
          bestIs = is_
          bestIt = it_
        }
        is_++
        it_++
      } else if (hs < ht) {
        is_++
      } else {
        it_++
      }
    }

    if (bestHub === -1) return null

    // Trace s → hub via label parent pointers (CH path with shortcuts)
    const chPathStoH = this.traceParents(ls, si, bestHub)
    // Trace t → hub via label parent pointers
    const chPathTtoH = this.traceParents(lt, ti, bestHub)

    // Unpack shortcuts to get original-graph path
    const pathStoH = this.unpackPath(chPathStoH)
    const pathTtoH = this.unpackPath(chPathTtoH)

    // Combine: s → hub → t (reverse the t→hub path)
    const result: VisibilityVertex[] = []
    for (const idx of pathStoH) {
      result.push(this.vertices[idx])
    }
    // pathTtoH goes [t, ..., hub], we need [hub, ..., t] = reversed, skip hub (already included)
    for (let i = pathTtoH.length - 2; i >= 0; i--) {
      result.push(this.vertices[pathTtoH[i]])
    }

    return result
  }

  /** Trace parent pointers in a label from vertex `from` to vertex `to`. Returns CH path indices. */
  private traceParents(label: LabelEntry[], from: number, to: number): number[] {
    if (from === to) return [from]

    // Build a map from hub → parent for this label
    const parentOf = new Map<number, number>()
    for (const entry of label) {
      parentOf.set(entry.hub, entry.parent)
    }

    const path: number[] = [to]
    let cur = to
    const visited = new Set<number>()
    while (cur !== from) {
      visited.add(cur)
      const p = parentOf.get(cur)
      if (p === undefined || p === -1 || visited.has(p)) {
        // Shouldn't happen for a valid label, but guard against infinite loops
        return [from, to]
      }
      path.push(p)
      cur = p
    }
    path.reverse()
    return path
  }

  /** Unpack a CH path (which may contain shortcuts) into an original-graph path. */
  private unpackPath(chPath: number[]): number[] {
    if (chPath.length <= 1) return chPath
    const result: number[] = [chPath[0]]
    for (let i = 0; i < chPath.length - 1; i++) {
      this.unpackEdge(chPath[i], chPath[i + 1], result)
    }
    return result
  }

  /** Recursively unpack a single CH edge, appending to result (excluding the source). */
  private unpackEdge(u: number, v: number, result: number[]) {
    const key = u < v ? u * this.n + v : v * this.n + u
    const mid = this.shortcutMiddle.get(key)
    if (mid === undefined) {
      // Original edge
      result.push(v)
    } else {
      // Shortcut: unpack u → mid → v
      this.unpackEdge(u, mid, result)
      this.unpackEdge(mid, v, result)
    }
  }

  // ─── Preprocessing ───

  private buildFromGraph(visGraph: VisibilityGraph) {
    this.buildVertexIndex(visGraph)
    this.buildAdjacency(visGraph)
    this.shortcutMiddle = new Map()
    this.computeContractionOrder()
    this.computeLabels()
  }

  private buildVertexIndex(visGraph: VisibilityGraph) {
    this.vertices = []
    this.vertexIndex = new Map()
    let idx = 0
    for (const v of visGraph.Vertices()) {
      this.vertices.push(v)
      this.vertexIndex.set(v, idx++)
    }
    this.n = this.vertices.length
  }

  private buildAdjacency(visGraph: VisibilityGraph) {
    this.adj = new Array(this.n)
    for (let i = 0; i < this.n; i++) {
      this.adj[i] = []
    }
    // Add all edges (undirected)
    for (const edge of visGraph.Edges) {
      const si = this.vertexIndex.get(edge.Source)
      const ti = this.vertexIndex.get(edge.Target)
      if (si === undefined || ti === undefined) continue
      const len = edge.Length
      this.adj[si].push({vertex: ti, length: len, middle: -1})
      this.adj[ti].push({vertex: si, length: len, middle: -1})
    }
  }

  // ─── Contraction Hierarchies (Section 3 of paper) ───

  private computeContractionOrder() {
    this.ranks = new Int32Array(this.n).fill(-1)
    this.order = new Int32Array(this.n)
    this.levels = new Int32Array(this.n)
    this.contracted = new Uint8Array(this.n)

    // Priority function from Section 3:
    // priority(u) = 2*ED(u) + CN(u) + H(u) + 5*L(u)
    // ED = edge difference, CN = contracted neighbors, H = hop count, L = level
    const pq = new GenericBinaryHeapPriorityQueue<number>()

    for (let i = 0; i < this.n; i++) {
      pq.Enqueue(i, this.contractionPriority(i))
    }

    let nextRank = 0
    while (!pq.IsEmpty()) {
      const t = {priority: 0}
      const v = pq.DequeueAndGetPriority(t)

      // Lazy update: recompute priority and re-insert if it increased
      const newPriority = this.contractionPriority(v)
      if (newPriority > t.priority && !pq.IsEmpty()) {
        pq.Enqueue(v, newPriority)
        continue
      }

      // Contract vertex v
      this.contractVertex(v)
      this.ranks[v] = nextRank
      this.order[nextRank] = v
      nextRank++
    }
  }

  private contractionPriority(v: number): number {
    if (this.contracted[v]) return Number.POSITIVE_INFINITY

    const neighbors = this.getActiveNeighbors(v)
    let contractedNeighborCount = 0
    for (const ne of this.adj[v]) {
      if (this.contracted[ne.vertex]) contractedNeighborCount++
    }

    // Compute edge difference (shortcuts added - edges removed)
    const shortcutsNeeded = this.countShortcutsNeeded(v, neighbors)
    const edgesRemoved = neighbors.length
    const edgeDiff = shortcutsNeeded - edgesRemoved

    return 2 * edgeDiff + contractedNeighborCount + 5 * this.levels[v]
  }

  /** Get active (non-contracted) neighbors of v with their edge lengths. */
  private getActiveNeighbors(v: number): CHNeighbor[] {
    const result: CHNeighbor[] = []
    for (const ne of this.adj[v]) {
      if (!this.contracted[ne.vertex]) {
        // Keep only the shortest edge to each neighbor
        const existing = result.find((r) => r.vertex === ne.vertex)
        if (!existing || ne.length < existing.length) {
          if (existing) {
            existing.length = ne.length
            existing.middle = ne.middle
          } else {
            result.push({vertex: ne.vertex, length: ne.length, middle: ne.middle})
          }
        }
      }
    }
    return result
  }

  /** Count how many shortcuts would be needed if v were contracted. */
  private countShortcutsNeeded(v: number, neighbors: CHNeighbor[]): number {
    let count = 0
    for (let i = 0; i < neighbors.length; i++) {
      const u = neighbors[i]
      const maxDist = u.length + this.maxNeighborDist(v, neighbors)
      const witnessDistances = this.witnessSearch(u.vertex, v, maxDist, neighbors)

      for (let j = 0; j < neighbors.length; j++) {
        if (i === j) continue
        const w = neighbors[j]
        const viaV = u.length + w.length
        const witnessDist = witnessDistances.get(w.vertex)
        if (witnessDist === undefined || witnessDist > viaV) {
          count++
        }
      }
    }
    return count
  }

  private maxNeighborDist(v: number, neighbors: CHNeighbor[]): number {
    let maxD = 0
    for (const ne of neighbors) {
      if (ne.length > maxD) maxD = ne.length
    }
    return maxD
  }

  /** Run a limited Dijkstra from source, avoiding vertex `avoid`, up to `maxDist`. */
  private witnessSearch(
    source: number,
    avoid: number,
    maxDist: number,
    targetNeighbors: CHNeighbor[],
  ): Map<number, number> {
    const dist = new Map<number, number>()
    dist.set(source, 0)

    // Track which targets we need to find
    const targetSet = new Set<number>()
    for (const ne of targetNeighbors) {
      if (ne.vertex !== source) targetSet.add(ne.vertex)
    }
    let targetsFound = 0

    const pq = new GenericBinaryHeapPriorityQueue<number>()
    pq.Enqueue(source, 0)

    // Limit the search to a reasonable number of settled vertices
    let settled = 0
    const maxSettled = Math.min(this.n, 200)

    while (!pq.IsEmpty() && settled < maxSettled) {
      const t = {priority: 0}
      const u = pq.DequeueAndGetPriority(t)
      if (t.priority > maxDist) break

      settled++
      if (targetSet.has(u)) {
        targetsFound++
        if (targetsFound >= targetSet.size) break
      }

      for (const ne of this.adj[u]) {
        if (ne.vertex === avoid || this.contracted[ne.vertex]) continue
        const newDist = t.priority + ne.length
        if (newDist > maxDist) continue
        const existing = dist.get(ne.vertex)
        if (existing === undefined) {
          dist.set(ne.vertex, newDist)
          pq.Enqueue(ne.vertex, newDist)
        } else if (newDist < existing) {
          dist.set(ne.vertex, newDist)
          if (pq.ContainsElement(ne.vertex)) {
            pq.DecreasePriority(ne.vertex, newDist)
          } else {
            pq.Enqueue(ne.vertex, newDist)
          }
        }
      }
    }

    return dist
  }

  /** Contract vertex v: find and add necessary shortcuts, mark as contracted. */
  private contractVertex(v: number) {
    const neighbors = this.getActiveNeighbors(v)

    // For each pair of active neighbors, check if shortcut is needed
    for (let i = 0; i < neighbors.length; i++) {
      const u = neighbors[i]
      const maxDist = u.length + this.maxNeighborDist(v, neighbors)
      const witnessDistances = this.witnessSearch(u.vertex, v, maxDist, neighbors)

      for (let j = 0; j < neighbors.length; j++) {
        if (i === j) continue
        const w = neighbors[j]
        if (u.vertex >= w.vertex) continue // avoid adding duplicate shortcuts (u,w) and (w,u)

        const viaV = u.length + w.length
        const witnessDist = witnessDistances.get(w.vertex)

        if (witnessDist === undefined || witnessDist > viaV) {
          // Add shortcut (u, w) with middle vertex v
          this.adj[u.vertex].push({vertex: w.vertex, length: viaV, middle: v})
          this.adj[w.vertex].push({vertex: u.vertex, length: viaV, middle: v})
          const key = u.vertex < w.vertex ? u.vertex * this.n + w.vertex : w.vertex * this.n + u.vertex
          this.shortcutMiddle.set(key, v)
        }
      }
    }

    this.contracted[v] = 1

    // Update levels: level(u) = max(level(u), level(v) + 1) for all active neighbors
    for (const ne of neighbors) {
      if (this.levels[ne.vertex] < this.levels[v] + 1) {
        this.levels[ne.vertex] = this.levels[v] + 1
      }
    }
  }

  // ─── Hub Label Computation (Section 4.2 + Section 5.1 of paper) ───

  private computeLabels() {
    this.labels = new Array(this.n)

    // Reset contracted flags for the label computation phase
    // (we use ranks now, not contracted flags)

    for (let i = 0; i < this.n; i++) {
      this.labels[i] = this.computeLabelForVertex(i)
    }
  }

  /** Compute the hub label for vertex v by running a Dijkstra search in G↑ (upward graph).
   *  Apply stall-on-demand pruning (Section 5.1). */
  private computeLabelForVertex(v: number): LabelEntry[] {
    const dist = new Float64Array(this.n).fill(Number.POSITIVE_INFINITY)
    const parent = new Int32Array(this.n).fill(-1)
    const visited = new Uint8Array(this.n)

    dist[v] = 0
    parent[v] = v

    const pq = new GenericBinaryHeapPriorityQueue<number>()
    pq.Enqueue(v, 0)

    const label: LabelEntry[] = []

    while (!pq.IsEmpty()) {
      const t = {priority: 0}
      const u = pq.DequeueAndGetPriority(t)

      if (t.priority > dist[u]) continue
      if (visited[u]) continue
      visited[u] = 1

      // Stall-on-demand pruning (Section 5.1):
      // Check if any lower-ranked neighbor has a better path to u
      if (u !== v && this.isStalled(u, dist)) continue

      // Pruning via existing labels (bootstrapping, Section 5.2):
      // If we already have labels for higher-ranked vertices, check if the current
      // distance can be explained by existing labels
      if (u !== v && this.canPruneByLabels(v, u, dist[u])) continue

      label.push({hub: u, distance: dist[u], parent: parent[u]})

      // Relax upward edges (edges to higher-ranked vertices)
      for (const ne of this.adj[u]) {
        if (this.ranks[ne.vertex] <= this.ranks[u]) continue // only go upward
        const newDist = dist[u] + ne.length
        if (newDist < dist[ne.vertex]) {
          dist[ne.vertex] = newDist
          parent[ne.vertex] = u
          pq.Enqueue(ne.vertex, newDist)
        }
      }
    }

    // Sort label by hub index for merge sweep queries
    label.sort((a, b) => a.hub - b.hub)
    return label
  }

  /** Stall-on-demand: check if vertex u's distance is incorrect by examining
   *  lower-ranked incoming edges (h-hop heuristic with h=1, Section 5.1). */
  private isStalled(u: number, dist: Float64Array): boolean {
    for (const ne of this.adj[u]) {
      if (this.ranks[ne.vertex] < this.ranks[u]) continue // only check downward edges
      // If a higher-ranked vertex w has dist[w] + len(w,u) < dist[u], then u is stalled
      if (dist[ne.vertex] + ne.length < dist[u] - 1e-10) {
        return true
      }
    }
    return false
  }

  /** Check if the distance from v to u can be covered by already-computed labels. */
  private canPruneByLabels(v: number, u: number, distVU: number): boolean {
    // Only prune if both labels are already computed (u has higher rank, so it's computed later
    // when processing in rank order... but we process all vertices)
    // For simplicity, we do the check if the label for u is already computed
    const lu = this.labels[u]
    if (!lu || lu.length === 0) return false

    // Check: is there a hub h in labels[v] ∩ labels[u] with dist(v,h) + dist(h,u) ≤ distVU?
    // But labels[v] is being computed right now, so we use the partial label
    // This is a simplified version of bootstrapping
    return false // Full bootstrapping would process in level order; skip for now
  }

  // ─── Static creation method ───

  static build(visGraph: VisibilityGraph): HubLabeling {
    return new HubLabeling(visGraph)
  }
}
