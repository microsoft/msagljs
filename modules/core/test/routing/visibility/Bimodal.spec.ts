import {BimodalSequence} from '../../../src/routing/visibility/BimodalSequence'

test('unimodal sequence', () => {
  let t = [0, 1, 2, 3, 1, 0, -1, -2, -3, -4, -2]
  const f = (m: number) => t[m]
  let us = new BimodalSequence(f, t.length)
  expect(us.FindMinimum()).toBe(t.length - 2)
  expect(us.FindMaximum()).toBe(3)
  t = [2, 3, 1]
  us = new BimodalSequence(f, t.length)
  expect(us.FindMinimum()).toBe(t.length - 1)
  expect(us.FindMaximum()).toBe(1)
})
