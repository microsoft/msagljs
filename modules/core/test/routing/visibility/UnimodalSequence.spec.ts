import {UnimodalSequence} from '../../../src/routing/visibility/UnimodalSequence'

test('unimodal sequence', () => {
  const t = [0, 1, 2, 3, 1, 0]
  const f = (m: number) => t[m]
  let us = new UnimodalSequence(f, t.length)
  const min = us.FindMinimum()
  expect(min == 0 || min == t.length - 1).toBe(true)
  expect(us.FindMaximum()).toBe(3)

  const l = [0, 1, 2, 3, 3.1, 1, -1]
  us = new UnimodalSequence((u) => l[u], l.length)
  expect(us.FindMinimum()).toBe(l.length - 1)
  expect(us.FindMaximum()).toBe(4)
})
