import {Point} from '../../../src'
import {BezierSeg} from '../../../src/math/geometry/bezierSeg'
import {closeDistEps} from '../../../src/utils/compare'

test('bezier control points', () => {
  const b = [new Point(0, 0), new Point(1, 0), new Point(1, 2), new Point(3, 0)]
  const bezSeg = new BezierSeg(b[0], b[1], b[2], b[3])
  for (let i = 0; i < 4; i++) {
    expect(bezSeg.B(i).equal(b[i])).toBeTruthy()
  }
})

test('bezier accessors', () => {
  const b = [new Point(0, 0), new Point(1, 1), new Point(2, 1), new Point(3, 0)]
  const bezSeg = new BezierSeg(b[0], b[1], b[2], b[3])
  const mid = 0.5
  const del = 0.1
  const pm = bezSeg.value(mid)
  expect(closeDistEps(pm.x, 3 / 2)).toBeTruthy()
  const der = bezSeg.derivative(mid)
  expect(closeDistEps(der.y, 0)).toBeTruthy()
  const t = mid + del
  const otherPoint = bezSeg.value(t)
  expect(otherPoint.y < pm.y).toBeTruthy()
  expect(pm.y < 1).toBeTruthy()
  const dx = 0.001
  const val_t_plus_dx = bezSeg.value(t + dx)
  const approx_val_at_t_plus_dx = bezSeg.value(t).add(bezSeg.derivative(t).mul(dx))
  expect(approx_val_at_t_plus_dx.sub(val_t_plus_dx).length < dx).toBe(true)
})

test('bezier length', () => {
  const b = [new Point(0, 0), new Point(100, 100), new Point(200, 10), new Point(300, 0)]
  const bezSeg = new BezierSeg(b[0], b[1], b[2], b[3])
  const l = bezSeg.length
  expect(l < b[1].sub(b[0]).length + b[2].sub(b[1]).length + b[2].sub(b[3]).length).toBe(true)
})

test('trim', () => {
  const b = [new Point(0, 0), new Point(100, 100), new Point(200, 10), new Point(300, 0)]
  const u = 0.3,
    v = 0.7
  const bezSeg = new BezierSeg(b[0], b[1], b[2], b[3])
  const trBez = bezSeg.trim(u, v)
  expect(Point.closeDistEps(bezSeg.value(u), trBez.value(0))).toBe(true)
  const trBez_ = bezSeg.trim(v, u)
  expect(Point.closeDistEps(bezSeg.value(v), trBez_.value(1))).toBe(true)

  const trBezPoint = trBez.trim(1, 1)
  expect(Point.closeDistEps(trBezPoint.value(0.5), trBez.value(1))).toBe(true)
})
