import {removeFromArray} from '../../src/utils/setOperations'

test('remove from array', () => {
  const arr = ['a', 'b', 'c']
  const t = 'b'
  removeFromArray(arr, t)
  expect(arr.length).toBe(2)
})
