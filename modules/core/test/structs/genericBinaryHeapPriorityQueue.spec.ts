import {GenericBinaryHeapPriorityQueue} from '../../src/structs/genericBinaryHeapPriorityQueue'

test('push many', () => {
  const q = new GenericBinaryHeapPriorityQueue<number>((a, b) => b - a)
  for (let i = 0; i < 30; i++) {
    q.Enqueue(i, i)
  }
  const arr = []

  while (!q.IsEmpty()) {
    const r = q.Dequeue()
    arr.push(r)
  }
  expect(arr.length).toBe(30)
})

test('pq general', () => {
  const q = new GenericBinaryHeapPriorityQueue<number>((a, b) => a - b)
  q.Enqueue(2, 2)
  q.Enqueue(1, 1)
  q.Enqueue(9, 9)
  q.Enqueue(8, 8)
  q.Enqueue(5, 5)
  q.Enqueue(3, 3)
  q.Enqueue(4, 4)
  q.Enqueue(7, 7)
  q.Enqueue(6, 6)
  q.Enqueue(0, 0)
  const arr = []

  while (!q.IsEmpty()) {
    const r = q.Dequeue()
    arr.push(r)
  }
  for (let i = 0; i < arr.length - 1; i++) {
    expect(arr[i]).toBeLessThan(arr[i + 1])
  }
})

test('pq decrease', () => {
  const q = new GenericBinaryHeapPriorityQueue<number>((a, b) => b - a)
  q.Enqueue(2, 2)
  q.Enqueue(1, 1)
  q.Enqueue(9, 9)
  q.Enqueue(8, 8)
  q.Enqueue(5, 5)
  q.Enqueue(3, 3)
  q.Enqueue(4, 4)
  q.Enqueue(7, 7)
  q.Enqueue(6, 6)
  q.Enqueue(0, 0)
  const arr = []

  q.DecreasePriority(4, 2.5)
  while (!q.IsEmpty()) {
    const t = {priority: 0}
    q.DequeueAndGetPriority(t)
    arr.push(t.priority)
  }
  for (let i = 0; i < arr.length - 1; i++) {
    expect(arr[i]).toBeGreaterThan(arr[i + 1])
  }
})
