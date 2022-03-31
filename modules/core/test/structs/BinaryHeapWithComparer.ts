import {Point} from '../../src'
import {LineSegment} from '../../src/math/geometry'
import {BinaryHeapWithComparer} from '../../src/structs/BinaryHeapWithComparer'

test('lines', () => {
  const short = LineSegment.mkPP(new Point(0, 0), new Point(1, 0))
  const medium = LineSegment.mkPP(new Point(0, 0), new Point(2, 0))
  const long = LineSegment.mkPP(new Point(0, 0), new Point(6, 0))
  const bh = new BinaryHeapWithComparer<LineSegment>((a, b) => a.length - b.length)
  bh.Enqueue(long)
  bh.Enqueue(short)
  bh.Enqueue(medium)
  let t = bh.Dequeue()
  expect(t).toBe(short)
  t = bh.Dequeue()
  expect(t).toBe(medium)
  t = bh.Dequeue()
  expect(t).toBe(long)
})
