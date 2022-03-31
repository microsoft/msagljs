import {Interval} from '../../../src/math/geometry/Interval'

test('interval add', () => {
  const i = new Interval(0, 1)
  const j = new Interval(1, 2)
  expect(i.contains_d(0.5)).toBeTruthy()
  expect(j.GetInRange(2.1)).toBe(2)
  const k = Interval.mkInterval(i, j)
  expect(k.end).toBe(2)
  expect(i.intersects(j)).toBeTruthy()
})
