import {LinearSystem2} from './../../../src/math/geometry/linearSystem'
test('linearSystem2 test', () => {
  let xy = LinearSystem2.solve(1, 0, 0, 0, 1, 0)
  expect(xy.x).toBe(0)
  expect(xy.y).toBe(0)
  xy = LinearSystem2.solve(0, 1, 0, 0, 1, 0)
  expect(xy).toBe(undefined)
})
