import {PointComparer} from '../../../src/routing/rectilinear/PointComparer'

test('equal', () => {
  expect(PointComparer.Equal(1.0, 1.0000001)).toBe(true)
  expect(PointComparer.Equal(1.0, 1.00001)).toBe(false)
  expect(PointComparer.Equal(1.0, 1.000001)).toBe(false)
})
