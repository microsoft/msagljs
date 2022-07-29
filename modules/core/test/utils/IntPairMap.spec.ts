import {IntPairMap} from '../../src/utils/IntPairMap'

test('IntPairMap', () => {
  const m = new IntPairMap<number>(3)
  m.set(0, 0, 0)
  m.set(1, 1, 2)
  m.set(2, 2, 4)
  m.set(2, 1, 3)

  const p = Array.from(m.keys())
  expect(p.length).toBe(4)
  expect(p[0].y < 3).toBe(true)
  const kv = Array.from(m.keyValues())
  expect(kv[0][1] < 5).toBe(true)
  expect(kv.length === 4).toBe(true)
})
