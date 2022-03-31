import {Point} from '../../../src'
import {VisibilityGraph} from '../../../src/routing/visibility/VisibilityGraph'

test('vg', () => {
  const g = new VisibilityGraph()
  g.AddVertexP(new Point(0, 0))
  g.AddVertexP(new Point(0, 1))
  const vv = [...g.Vertices()]
  expect(vv.length).toBe(2)
})
test('vg0', () => {
  const g = new VisibilityGraph()
  g.AddVertexP(new Point(0, 0))
  g.AddVertexP(new Point(0, 1))
  const v = g.FindVertex(new Point(0, 0))
  expect(v.point.equal(new Point(0, 0))).toBe(true)
  const u = g.FindVertex(new Point(0, 0.5))
  expect(u == undefined).toBe(true)
  g.RemoveVertex(v)
})

test('e0', () => {
  const g = new VisibilityGraph()
  const a = new Point(0, 0)
  const b = new Point(1, 2)
  const c = new Point(5, 0)
  g.AddVertexP(a)
  g.AddVertexP(b)
  g.AddVertexP(c)
  const ab = g.AddEdgePP(a, b)
  const e_ab = g.FindEdgePP(a, b)
  expect(ab).toBe(e_ab)
})
