// eslint-disable-next-line @typescript-eslint/no-unused-vars

import {Point} from '../../../src'
import {GeomConstants, Curve, CurveFactory, LineSegment} from '../../../src/math/geometry'
import {Ellipse} from '../../../src/math/geometry/ellipse'
import {PlaneTransformation} from '../../../src/math/geometry/planeTransformation'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test('ellipse value test', () => {
  const a = new Point(100, 0)
  const b = new Point(0, 200)
  const cen = new Point(-100, 0)
  const ell = Ellipse.mkEllipsePPP(a, b, cen)
  const t = 0.3
  expect(Point.close(ell.value(t), a.mul(Math.cos(t)).add(b.mul(Math.sin(t))), GeomConstants.distanceEpsilon)).toBeTruthy
})

test('intersect quarters', () => {
  const rr = new Ellipse(0, Math.PI / 2, new Point(100, 0), new Point(0, 100), new Point(0, 0))
  const rc = rr.clone()
  rc.translate(new Point(-3, 3))
  const xx = Curve.getAllIntersections(rr, rc, true)
  expect(xx.length === 1).toBeTruthy()
  expect(Point.close(rr.value(xx[0].par0), xx[0].x, GeomConstants.intersectionEpsilon)).toBe(true)
})

test('intersect and value', () => {
  const circle = CurveFactory.mkCircle(15, new Point(0, 0))
  const flipCircle = <Ellipse>circle.transform(new PlaneTransformation(1, 0, 0, 0, -1, 0)) // flip by Y
  const ls = LineSegment.mkPP(new Point(-100, 10), new Point(0, 10))
  {
    const circleIntersections = Curve.getAllIntersections(ls, circle, true)
    expect(circleIntersections.length).toBe(1)
    const x = circleIntersections[0]
    expect(Point.closeDistEps(x.x, circle.value(x.par1))).toBe(true)
  }
  {
    const circleIntersections = Curve.getAllIntersections(ls, flipCircle, true)
    expect(circleIntersections.length).toBe(1)
    const x = circleIntersections[0]
    expect(Point.closeDistEps(x.x, flipCircle.value(x.par1))).toBe(true)
  }
})
