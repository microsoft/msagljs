import {Point} from '../../src'
import {HubLabeling} from '../../src/routing/HubLabeling'
import {SingleSourceSingleTargetShortestPathOnVisibilityGraph} from '../../src/routing/SingleSourceSingleTargetShortestPathOnVisibilityGraph'
import {VisibilityEdge} from '../../src/routing/visibility/VisibilityEdge'
import {VisibilityGraph} from '../../src/routing/visibility/VisibilityGraph'
import {VisibilityVertex} from '../../src/routing/visibility/VisibilityVertex'

/** Build a simple path graph: v0 - v1 - v2 - ... - vn-1 */
function buildPathGraph(n: number): {vg: VisibilityGraph; verts: VisibilityVertex[]} {
  const vg = new VisibilityGraph()
  const verts: VisibilityVertex[] = []
  for (let i = 0; i < n; i++) {
    verts.push(vg.AddVertexP(new Point(i, 0)))
  }
  for (let i = 0; i < n - 1; i++) {
    VisibilityGraph.AddEdge(new VisibilityEdge(verts[i], verts[i + 1]))
  }
  return {vg, verts}
}

/** Build a grid graph: n×m grid with unit-distance edges */
function buildGridGraph(rows: number, cols: number): {vg: VisibilityGraph; verts: VisibilityVertex[][]} {
  const vg = new VisibilityGraph()
  const verts: VisibilityVertex[][] = []
  for (let r = 0; r < rows; r++) {
    verts[r] = []
    for (let c = 0; c < cols; c++) {
      verts[r][c] = vg.AddVertexP(new Point(c, r))
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) VisibilityGraph.AddEdge(new VisibilityEdge(verts[r][c], verts[r][c + 1]))
      if (r + 1 < rows) VisibilityGraph.AddEdge(new VisibilityEdge(verts[r][c], verts[r + 1][c]))
    }
  }
  return {vg, verts}
}

/** Compute shortest path distance using Dijkstra for verification. */
function dijkstraDistance(vg: VisibilityGraph, s: VisibilityVertex, t: VisibilityVertex): number {
  if (s === t) return 0
  vg.ClearPrevEdgesTable()
  for (const v of vg.Vertices()) v.Distance = Number.POSITIVE_INFINITY
  const sp = new SingleSourceSingleTargetShortestPathOnVisibilityGraph(vg, s, t)
  const path = sp.GetPath(false)
  if (path == null) return Number.POSITIVE_INFINITY
  // compute total path length
  let totalLen = 0
  for (let i = 0; i < path.length - 1; i++) {
    totalLen += path[i].point.sub(path[i + 1].point).length
  }
  return totalLen
}

describe('HubLabeling', () => {
  test('simple triangle graph', () => {
    const vg = new VisibilityGraph()
    const a = vg.AddVertexP(new Point(0, 0))
    const b = vg.AddVertexP(new Point(1, 0))
    const c = vg.AddVertexP(new Point(0.5, Math.sqrt(3) / 2))
    VisibilityGraph.AddEdge(new VisibilityEdge(a, b))
    VisibilityGraph.AddEdge(new VisibilityEdge(b, c))
    VisibilityGraph.AddEdge(new VisibilityEdge(a, c))

    const hl = HubLabeling.build(vg)

    // a→b: direct edge, distance = 1
    expect(hl.queryDistance(a, b)).toBeCloseTo(1, 8)
    // a→c: direct edge
    expect(hl.queryDistance(a, c)).toBeCloseTo(1, 8)
    // b→c: direct edge
    expect(hl.queryDistance(b, c)).toBeCloseTo(1, 8)
    // self distance
    expect(hl.queryDistance(a, a)).toBe(0)
  })

  test('path graph distances match Dijkstra', () => {
    const {vg, verts} = buildPathGraph(10)
    const hl = HubLabeling.build(vg)

    for (let i = 0; i < verts.length; i++) {
      for (let j = i; j < verts.length; j++) {
        const hlDist = hl.queryDistance(verts[i], verts[j])
        const dDist = dijkstraDistance(vg, verts[i], verts[j])
        expect(hlDist).toBeCloseTo(dDist, 6)
      }
    }
  })

  test('grid graph distances match Dijkstra', () => {
    const {vg, verts} = buildGridGraph(5, 5)
    const hl = HubLabeling.build(vg)

    // Check several pairs
    const pairs: [number, number, number, number][] = [
      [0, 0, 4, 4], // corner to corner
      [0, 0, 0, 4], // along top edge
      [0, 0, 4, 0], // along left edge
      [2, 2, 4, 4], // center to corner
      [1, 1, 3, 3], // middle pairs
    ]
    for (const [r1, c1, r2, c2] of pairs) {
      const hlDist = hl.queryDistance(verts[r1][c1], verts[r2][c2])
      const dDist = dijkstraDistance(vg, verts[r1][c1], verts[r2][c2])
      expect(hlDist).toBeCloseTo(dDist, 6)
    }
  })

  test('path reconstruction on path graph', () => {
    const {vg, verts} = buildPathGraph(5)
    const hl = HubLabeling.build(vg)

    const path = hl.queryPath(verts[0], verts[4])
    expect(path).not.toBeNull()
    // Path should start at verts[0] and end at verts[4]
    expect(path![0]).toBe(verts[0])
    expect(path![path!.length - 1]).toBe(verts[4])

    // Verify total path distance
    let totalLen = 0
    for (let i = 0; i < path!.length - 1; i++) {
      totalLen += path![i].point.sub(path![i + 1].point).length
    }
    const expectedLen = dijkstraDistance(vg, verts[0], verts[4])
    expect(totalLen).toBeCloseTo(expectedLen, 6)
  })

  test('path reconstruction on grid graph', () => {
    const {vg, verts} = buildGridGraph(4, 4)
    const hl = HubLabeling.build(vg)

    const path = hl.queryPath(verts[0][0], verts[3][3])
    expect(path).not.toBeNull()
    expect(path![0]).toBe(verts[0][0])
    expect(path![path!.length - 1]).toBe(verts[3][3])

    // Verify total path distance
    let totalLen = 0
    for (let i = 0; i < path!.length - 1; i++) {
      totalLen += path![i].point.sub(path![i + 1].point).length
    }
    const expectedLen = dijkstraDistance(vg, verts[0][0], verts[3][3])
    expect(totalLen).toBeCloseTo(expectedLen, 6)
  })

  test('single vertex graph', () => {
    const vg = new VisibilityGraph()
    const a = vg.AddVertexP(new Point(0, 0))
    const hl = HubLabeling.build(vg)

    expect(hl.queryDistance(a, a)).toBe(0)
    const path = hl.queryPath(a, a)
    expect(path).toEqual([a])
  })

  test('two vertex graph', () => {
    const vg = new VisibilityGraph()
    const a = vg.AddVertexP(new Point(0, 0))
    const b = vg.AddVertexP(new Point(3, 4))
    VisibilityGraph.AddEdge(new VisibilityEdge(a, b))

    const hl = HubLabeling.build(vg)
    expect(hl.queryDistance(a, b)).toBeCloseTo(5, 8)

    const path = hl.queryPath(a, b)
    expect(path).not.toBeNull()
    expect(path!.length).toBe(2)
    expect(path![0]).toBe(a)
    expect(path![1]).toBe(b)
  })

  test('graph with multiple shortest paths', () => {
    // Diamond graph: s → a → t, s → b → t, with equal lengths
    const vg = new VisibilityGraph()
    const s = vg.AddVertexP(new Point(0, 0))
    const a = vg.AddVertexP(new Point(1, 1))
    const b = vg.AddVertexP(new Point(1, -1))
    const t = vg.AddVertexP(new Point(2, 0))
    VisibilityGraph.AddEdge(new VisibilityEdge(s, a))
    VisibilityGraph.AddEdge(new VisibilityEdge(s, b))
    VisibilityGraph.AddEdge(new VisibilityEdge(a, t))
    VisibilityGraph.AddEdge(new VisibilityEdge(b, t))

    const hl = HubLabeling.build(vg)
    const hlDist = hl.queryDistance(s, t)
    const dDist = dijkstraDistance(vg, s, t)
    expect(hlDist).toBeCloseTo(dDist, 6)

    const path = hl.queryPath(s, t)
    expect(path).not.toBeNull()
    expect(path![0]).toBe(s)
    expect(path![path!.length - 1]).toBe(t)
  })

  test('larger grid: all-pairs distances match Dijkstra', () => {
    const {vg, verts} = buildGridGraph(6, 6)
    const hl = HubLabeling.build(vg)

    // Check a representative set of vertex pairs
    const flatVerts = verts.flat()
    for (let i = 0; i < flatVerts.length; i += 3) {
      for (let j = i; j < flatVerts.length; j += 5) {
        const hlDist = hl.queryDistance(flatVerts[i], flatVerts[j])
        const dDist = dijkstraDistance(vg, flatVerts[i], flatVerts[j])
        expect(hlDist).toBeCloseTo(dDist, 5)
      }
    }
  })

  test('star graph', () => {
    // Central vertex connected to n outer vertices
    const vg = new VisibilityGraph()
    const center = vg.AddVertexP(new Point(0, 0))
    const outer: VisibilityVertex[] = []
    const n = 8
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n
      const v = vg.AddVertexP(new Point(Math.cos(angle), Math.sin(angle)))
      outer.push(v)
      VisibilityGraph.AddEdge(new VisibilityEdge(center, v))
    }

    const hl = HubLabeling.build(vg)

    // center to any outer: distance = 1
    for (const v of outer) {
      expect(hl.queryDistance(center, v)).toBeCloseTo(1, 8)
    }

    // outer to outer: distance = 2 (through center)
    for (let i = 0; i < outer.length; i++) {
      for (let j = i + 1; j < outer.length; j++) {
        const expected = dijkstraDistance(vg, outer[i], outer[j])
        expect(hl.queryDistance(outer[i], outer[j])).toBeCloseTo(expected, 6)
      }
    }
  })

  test('disconnected vertices return infinity', () => {
    const vg = new VisibilityGraph()
    const a = vg.AddVertexP(new Point(0, 0))
    const b = vg.AddVertexP(new Point(1, 0))
    const c = vg.AddVertexP(new Point(2, 0))
    VisibilityGraph.AddEdge(new VisibilityEdge(a, b))
    // c is disconnected

    const hl = HubLabeling.build(vg)
    expect(hl.queryDistance(a, c)).toBe(Number.POSITIVE_INFINITY)
    expect(hl.queryPath(a, c)).toBeNull()
  })

  test('unknown vertex returns infinity/null', () => {
    const vg = new VisibilityGraph()
    const a = vg.AddVertexP(new Point(0, 0))
    const hl = HubLabeling.build(vg)

    // Create a vertex not in the graph
    const outside = new VisibilityVertex(new Point(99, 99))
    expect(hl.queryDistance(a, outside)).toBe(Number.POSITIVE_INFINITY)
    expect(hl.queryPath(a, outside)).toBeNull()
  })

  test('symmetric distances', () => {
    const {vg, verts} = buildGridGraph(4, 4)
    const hl = HubLabeling.build(vg)

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 4; k++) {
          for (let l = 0; l < 4; l++) {
            const d1 = hl.queryDistance(verts[i][j], verts[k][l])
            const d2 = hl.queryDistance(verts[k][l], verts[i][j])
            expect(d1).toBeCloseTo(d2, 8)
          }
        }
      }
    }
  })

  test('matches existing test case from SingleSourceSingleTarget', () => {
    // Reproduce the exact graph from the existing ssstsp test
    const vg = new VisibilityGraph()
    const upperVVs = []
    for (let i = 0; i < 9; i++) {
      upperVVs.push(vg.AddVertexP(new Point(i, 1)))
    }
    const origin = vg.AddVertexP(new Point(0, 0))
    for (let i = 0; i < upperVVs.length - 1; i++) {
      VisibilityGraph.AddEdge(new VisibilityEdge(upperVVs[i], upperVVs[i + 1]))
      VisibilityGraph.AddEdge(new VisibilityEdge(origin, upperVVs[i]))
    }
    const middleVertex = vg.AddVertexP(new Point(0.5, 0.5))
    VisibilityGraph.AddEdge(new VisibilityEdge(middleVertex, origin))
    VisibilityGraph.AddEdge(new VisibilityEdge(middleVertex, upperVVs[upperVVs.length - 2]))

    const hl = HubLabeling.build(vg)

    // Verify distance to last vertex (should go origin → upperVVs[7] → upperVVs[8])
    const target = upperVVs[upperVVs.length - 1]
    const hlDist = hl.queryDistance(origin, target)
    const dDist = dijkstraDistance(vg, origin, target)
    expect(hlDist).toBeCloseTo(dDist, 6)
  })
})
