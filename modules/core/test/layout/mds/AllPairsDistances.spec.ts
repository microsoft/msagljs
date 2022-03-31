import {Graph, Edge, CurveFactory, Point, GeomEdge, GeomNode, Node} from '../../../src'
import {GeomObject} from '../../../src/layout/core/geomObject'
import {AllPairsDistances} from '../../../src/layout/mds/AllPairsDistances'
import {createGeometry} from '../../utils/testUtils'

test('all pairs distances', () => {
  const graph = new Graph()
  // make a trapeze (abcd), with sides ab = 1, bc = 0.5, cd = 1, da = 1
  const a = new Node('a')
  const b = new Node('b')
  const c = new Node('c')
  const d = new Node('d')
  graph.addNode(a)
  graph.addNode(b)
  graph.addNode(c)
  graph.addNode(d)
  new Edge(a, b)
  const bc = new Edge(b, c)
  new Edge(c, d)
  new Edge(d, a)

  const nodes = []
  for (const n of graph.shallowNodes) {
    nodes.push(n)
  }

  // make sure that we iterate the nodes in the order abcd
  for (let i = 0; i < nodes.length; i++) expect(nodes[i].id.charAt(0)).toBe('abcd'.charAt(i))

  const geomGraph = createGeometry(
    graph,
    () => CurveFactory.createRectangle(10, 10, new Point(0, 0)),
    () => null,
  )
  const length = (e: GeomEdge) => (e.edge == bc ? 0.5 : 1)
  const ss = new AllPairsDistances(geomGraph, length)
  ss.run()
  const res = ss.Result
  expect(res.length).toBe(4)
  expect(res[0][0]).toBe(0)
  expect(res[0][1]).toBe(1)
  expect(res[0][2]).toBe(1.5)
  expect(res[0][3]).toBe(1)
  expect(res[1][0]).toBe(1)
  expect(res[1][1]).toBe(0)
  expect(res[1][2]).toBe(0.5)
  expect(res[1][3]).toBe(1.5)
  expect(res[2][0]).toBe(1.5)
  expect(res[2][1]).toBe(0.5)
  expect(res[2][2]).toBe(0)
  expect(res[2][3]).toBe(1)
  expect(res[3][0]).toBe(res[0][3])
  expect(res[3][1]).toBe(res[1][3])
  expect(res[3][2]).toBe(res[2][3])
  expect(res[3][3]).toBe(res[3][3])

  const stress0 = AllPairsDistances.Stress(geomGraph, length)
  // position the nodes somehow reasonable as a trapeze
  // leave 'a' at (0,0)
  const gb = <GeomNode>GeomObject.getGeom(b)
  gb.center = new Point(0.5, 0.5)
  const gc = <GeomNode>GeomObject.getGeom(c)
  gc.center = new Point(1.5, 0.5)

  const gd = <GeomNode>GeomObject.getGeom(d)
  gd.center = new Point(2, 0)
  const stress1 = AllPairsDistances.Stress(geomGraph, length)

  //(<GeomNode>GeomObject.getGeom(c)).center = new Point(0.5, 0.5)
  expect(stress0 > stress1).toBe(true)
})
