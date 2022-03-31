import {PointMap} from '../../src/utils/PointMap'

test('PointMap', () => {
  const m = new PointMap<number>()
  m.setxy(0, 0, 0)
  m.setxy(1.3, 1, 2)
  m.setxy(2, 2, 4)
  m.setxy(2, 1.2, 3)

  const p = Array.from(m.keys())
  expect(p.length).toBe(4)
  expect(p[0].y < 3).toBe(true)
  const kv = Array.from(m)
  expect(kv[0][1] < 5).toBe(true)
  expect(kv.length == 4).toBe(true)

  m.delete(1.3, 1)
  expect(m.hasxy(1.3, 1)).toBe(false)
  expect(m.hasxy(2, 1.2)).toBe(true)
})
