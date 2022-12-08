import {Graph, Node, Edge, Rectangle} from '../../src'
import {pageRank, shallowConnectedComponents} from '../../src/structs/graph'
import {setsAreEqual} from '../../src/utils/setOperations'
import {parseDotGraph} from '../utils/testUtils'

test('pagerank', () => {
  const graph = parseDotGraph('graphvis/clust3.gv')
  const rank = pageRank(graph, 0.85)
  expect(rank.size).toBe(graph.nodeCountDeep)
})

test('graph create', () => {
  const g = new Graph()
  expect(g.shallowNodeCount).toBe(0)
  expect(g.edgeCount).toBe(0)
  const n = new Node('n')
  g.addNode(n)
  expect(g.shallowNodeCount).toBe(1)
  expect(g.edgeCount).toBe(0)

  let e = new Edge(n, n)
  g.addEdge(e)
  expect(g.edgeCount).toBe(1)

  const a = new Node('a')
  e = new Edge(a, n)
  g.addEdge(e)
  expect(g.shallowNodeCount).toBe(2)
  expect(g.edgeCount).toBe(2)

  e = new Edge(n, a)
  expect(g.shallowNodeCount).toBe(2)
  expect(g.edgeCount).toBe(3)

  expect(g.isConsistent()).toBe(true)

  const b = new Node('b')
  e = new Edge(a, b)
  // at this point the edge does not belong to this.nodes

  g.addEdge(e)
  expect(g.isConsistent()).toBe(true)
})

test('node add graph', () => {
  const g = new Graph()
  const g0 = new Graph('g0')
  const m = new Node('m')
  g.addNode(g0)
  g.addNode(m)
  const graphs = new Array<Graph>()
  for (const gr of g.graphs()) {
    graphs.push(gr)
  }
  expect(graphs.length).toBe(1)
  const g1 = new Graph('g1')
  g0.addNode(g1)
  for (const gr of g0.graphs()) graphs.push(gr)
  expect(graphs.length).toBe(2)
  expect(g0.liftNode(g1)).toBe(g1)
})

test('graph delete node', () => {
  const g = new Graph()
  const n = new Node('n')
  g.addNode(n)

  let e = new Edge(n, n)
  g.addEdge(e)
  expect(g.edgeCount).toBe(1)
  const a = new Node('a')
  e = new Edge(a, n)
  g.addEdge(e)
  expect(g.isConsistent()).toBe(true)

  const b = new Node('b')
  e = new Edge(a, b)

  g.addEdge(e)
  expect(g.isConsistent()).toBe(true)
  expect(g.nodeIsConsistent(n)).toBe(true)
  g.removeNode(n)
  expect(g.shallowNodeCount).toBe(2)
  expect(g.isConsistent()).toBe(true)
  g.removeNode(a)
  expect(g.isConsistent()).toBe(true)
  expect(g.shallowNodeCount).toBe(1)
  expect(g.edgeCount).toBe(0)
})

test('graph attr', () => {
  const g = new Graph()
  const rect = new Rectangle({left: 0, right: 1, bottom: 0, top: 1})
  g.setAttr(0, rect)
  let r = g.getAttr(0) as Rectangle
  expect(r.width).toBe(rect.width)
  g.setAttr(3, rect)
  expect(g.getAttr(2)).toBe(undefined)
  r = g.getAttr(0) as Rectangle
  expect(r.width).toBe(rect.width)
})

test('connected comps', () => {
  const g = new Graph()
  const a = g.addNode(new Node('a'))
  const b = g.addNode(new Node('b'))
  const c = g.addNode(new Node('c'))
  const d = g.addNode(new Node('d'))
  const e = g.addNode(new Node('e'))
  const nodes = Array.from(g.shallowNodes)
  expect(nodes.length).toBe(5)
  let cc = Array.from(shallowConnectedComponents(g))
  expect(cc.length).toBe(5)
  new Edge(a, b)
  cc = Array.from(shallowConnectedComponents(g))
  expect(cc.length).toBe(4)

  new Edge(d, c)
  new Edge(c, e)
  cc = Array.from(shallowConnectedComponents(g))

  expect(cc.length).toBe(2)
  expect(cc[0].length).toBe(2)
  expect(cc[1].length).toBe(3)
  const cc1 = new Set<Node>()
  cc1.add(c)

  cc1.add(d)
  cc1.add(e)
  for (const n of cc[1]) expect(cc1.has(n))
  new Edge(e, a)
  new Edge(e, a)
  cc = Array.from(shallowConnectedComponents(g))
  expect(cc.length).toBe(1)
  expect(cc[0].length).toBe(5)

  const a_edges = []
  for (const e of a.edges) a_edges.push(e)

  for (const e of a_edges) e.remove()

  cc = Array.from(shallowConnectedComponents(g))
  expect(cc.length).toBe(3)
  const tt = Array.from(g.getClusteredConnectedComponents())
  expect(cc.length).toBe(tt.length)
})

test('GetClusteredConnectedComponents', () => {
  const g = parseDotGraph('graphvis/clust3.gv')
  const comps = Array.from(g.getClusteredConnectedComponents())
  expect(comps.length).toBe(2)
  const expectedSizes = new Set<number>()
  expectedSizes.add(3)
  expectedSizes.add(2)
  const sizes = new Set<number>()
  for (const comp of comps) {
    sizes.add(comp.length)
  }
  expect(setsAreEqual(expectedSizes, sizes)).toBe(true)
})
