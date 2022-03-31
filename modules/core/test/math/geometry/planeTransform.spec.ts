import {Point} from '../../../src'
import {GeomConstants} from '../../../src/math/geometry'
import {PlaneTransformation} from '../../../src/math/geometry/planeTransformation'

test('mult point test', () => {
  const m = PlaneTransformation.rotation(Math.PI / 2)
  const p = new Point(1, 0)
  const mp = m.multiplyPoint(p)
  const pr = new Point(0, 1)
  expect(Point.close(pr, mp, GeomConstants.distanceEpsilon)).toBeTruthy()
})

test('plane transform test', () => {
  const m = PlaneTransformation.getIdentity()

  expect(m.isIdentity()).toBe(true)

  const p = new Point(2, 3)
  const m0 = new PlaneTransformation(1, 2, 3, 4, 5, 6)
  const m1 = new PlaneTransformation(2, 3, 4, 5, 6, 7)

  const m1m0p = m1.multiply(m0).multiplyPoint(p)
  const m1m0p_ = m1.multiplyPoint(m0.multiplyPoint(p))
  expect(Point.close(m1m0p, m1m0p_, 0.00001)).toBe(true)

  const invm0 = m0.inverse()
  expect(invm0.multiply(m0).isIdentity()).toBe(true)
  expect(m0.multiply(invm0).isIdentity()).toBe(true)
})
