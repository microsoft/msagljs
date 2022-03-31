import {CancelToken} from '../../../../src'
import {NetworkSimplex} from '../../../../src/layout/layered/layering/NetworkSimplex'
import {PolyIntEdge} from '../../../../src/layout/layered/polyIntEdge'
import {mkGraphOnEdgesArray} from '../../../../src/structs/basicGraphOnEdges'

test('network simplex', () => {
  // This is the example from North, Gansnern etc. 1993 paper
  // (ab)(bc)(cd)(dh)(af)(fg)(ae)(eg)(gh)
  const a = 0
  const b = 1
  const c = 2
  const d = 3
  const e = 4
  const f = 5
  const g = 6
  const h = 7
  const edge = (a: number, b: number) => new PolyIntEdge(a, b, null)
  const edges = [edge(a, b), edge(b, c), edge(c, d), edge(d, h), edge(a, f), edge(f, g), edge(a, e), edge(e, g), edge(g, h)]
  const graph = mkGraphOnEdgesArray(edges)
  const ns = new NetworkSimplex(graph, new CancelToken())
  ns.run()
  expect(ns.weight).toBe(10)
})
