import {Point} from '../../src'
import {LineSegment} from '../../src/math/geometry'
import {BinaryHeapWithComparer} from '../../src/structs/BinaryHeapWithComparer'

test('lines', () => {
  const short = LineSegment.mkPP(new Point(0, 0), new Point(1, 0))
  const medium = LineSegment.mkPP(new Point(0, 0), new Point(2, 0))
  const long = LineSegment.mkPP(new Point(0, 0), new Point(6, 0))
  const bh = new BinaryHeapWithComparer<LineSegment>((a, b) => a.length - b.length)
  bh.Enqueue(long)
  bh.Enqueue(long)
  bh.Enqueue(short)
  bh.Enqueue(short)
  bh.Enqueue(medium)
  bh.Enqueue(medium) // ssmmll
  expect(bh.Dequeue()).toBe(short)
  bh.Enqueue(long) //smmlll
  expect(bh.Dequeue()).toBe(short)
  expect(bh.Dequeue()).toBe(medium)
  expect(bh.Dequeue()).toBe(medium)
  expect(bh.Dequeue()).toBe(long)
  expect(bh.Dequeue()).toBe(long)
  expect(bh.Dequeue()).toBe(long)
})
