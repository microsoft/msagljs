import {Point} from '../../../src'
import {EventQueue} from '../../../src/routing/rectilinear/EventQueue'
import {ScanDirection} from '../../../src/routing/rectilinear/ScanDirection'
import {SweepEvent} from '../../../src/routing/spline/coneSpanner/SweepEvent'

class Event extends SweepEvent {
  p: Point
  get Site(): Point {
    return this.p
  }
  constructor(p: Point) {
    super()
    this.p = p
  }
}
test('evq', () => {
  const q = new EventQueue()
  q.scanDirection = ScanDirection.HorizontalInstance
  const n = 5
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      q.Enqueue(new Event(new Point(i, j)))
    }
  }
  const horq: Event[] = []
  while (q.Count > 0) {
    horq.push(<Event>q.Dequeue())
  }
  q.Reset(ScanDirection.VerticalInstance)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      q.Enqueue(new Event(new Point(i, j)))
    }
  }
  const verq: Event[] = []
  while (q.Count > 0) {
    verq.push(<Event>q.Dequeue())
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      expect(horq[j + i * n].Site.equal(verq[i + j * n].Site)).toBe(true)
    }
  }
})
