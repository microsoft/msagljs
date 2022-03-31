import {Rectangle, Point} from '../../../src'

test('rectangle test', () => {
  const r = new Rectangle({left: 0, right: 1, top: 1, bottom: 0})
  const p = new Point(0.3, 0.3)
  expect(r.contains(p)).toBe(true)
  const r0 = new Rectangle({left: 1, right: 4, top: 1, bottom: 0})
  expect(r.intersects(r0)).toBe(true)
  r0.center = new Point(12, 0)
  expect(r.intersects(r0)).toBe(false)
})
