import {IntPairMap} from '../../src/utils/IntPairMap'
import {initRandom, randomInt} from '../../src/utils/random'

test('trivial IntPairMap', () => {
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
/** shows that IntPairMap<number> is faster than Map<string,number>  */
xtest('intpairmap speed', () => {
  initRandom(0)
  const n = 1000
  const m = new IntPairMap<number>(n)
  const ms = new Map<string, number>()
  console.time('intPairs')
  for (let i = 0; i < 1000000; i++) {
    const x = randomInt(n)
    const y = randomInt(n)
    const v = randomInt(n)
    m.set(x, y, v)
  }
  for (let i = 0; i < 1000; i++) {
    for (let j = 0; j < 1000; j++) {
      m.get(i, j)
    }
  }
  console.timeEnd('intPairs')
  initRandom(0)

  console.time('strings')
  for (let i = 0; i < 1000000; i++) {
    const x = randomInt(n)
    const y = randomInt(n)
    const v = randomInt(n)
    const key = x.toString() + ' ' + y.toString()
    ms.set(key, v)
  }
  for (let i = 0; i < 1000; i++) {
    for (let j = 0; j < 1000; j++) {
      const key = i.toString() + ' ' + j.toString()
      ms.get(key)
    }
  }
  console.timeEnd('strings')
})
