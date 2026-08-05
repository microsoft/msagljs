import {Point} from '../../../src'
import {PointArray} from '../../../src/math/geometry/pointArray'

describe('PointArray', () => {
  test('push and getPoint', () => {
    const pa = new PointArray()
    pa.push(1, 2)
    pa.push(3, 4)
    pa.push(5, 6)
    expect(pa.length).toBe(3)

    const p0 = pa.getPoint(0)
    expect(p0.x).toBe(1)
    expect(p0.y).toBe(2)

    const p2 = pa.getPoint(2)
    expect(p2.x).toBe(5)
    expect(p2.y).toBe(6)
  })

  test('getPoint with reusable out parameter (zero allocation)', () => {
    const pa = new PointArray()
    pa.push(10, 20)
    pa.push(30, 40)

    const scratch = new Point(0, 0)
    pa.getPoint(0, scratch)
    expect(scratch.x).toBe(10)
    expect(scratch.y).toBe(20)

    pa.getPoint(1, scratch)
    expect(scratch.x).toBe(30)
    expect(scratch.y).toBe(40)
  })

  test('setPoint writes back to array', () => {
    const pa = new PointArray()
    pa.push(0, 0)

    const p = new Point(99, 88)
    pa.setPoint(0, p)
    expect(pa.getX(0)).toBe(99)
    expect(pa.getY(0)).toBe(88)
  })

  test('setXY', () => {
    const pa = new PointArray()
    pa.push(0, 0)
    pa.setXY(0, 7, 8)
    expect(pa.getX(0)).toBe(7)
    expect(pa.getY(0)).toBe(8)
  })

  test('pushPoint from Point object', () => {
    const pa = new PointArray()
    const idx = pa.pushPoint(new Point(42, 43))
    expect(idx).toBe(0)
    expect(pa.getX(0)).toBe(42)
    expect(pa.getY(0)).toBe(43)
  })

  test('pop returns last point', () => {
    const pa = new PointArray()
    pa.push(1, 2)
    pa.push(3, 4)

    const p = pa.pop()
    expect(p.x).toBe(3)
    expect(p.y).toBe(4)
    expect(pa.length).toBe(1)

    const scratch = new Point(0, 0)
    pa.pop(scratch)
    expect(scratch.x).toBe(1)
    expect(scratch.y).toBe(2)
    expect(pa.length).toBe(0)

    expect(pa.pop()).toBeUndefined()
  })

  test('fromPoints', () => {
    const points = [new Point(1, 2), new Point(3, 4), new Point(5, 6)]
    const pa = PointArray.fromPoints(points)
    expect(pa.length).toBe(3)
    expect(pa.getX(1)).toBe(3)
    expect(pa.getY(1)).toBe(4)
  })

  test('fromFlatArray with number[]', () => {
    const pa = PointArray.fromFlatArray([10, 20, 30, 40])
    expect(pa.length).toBe(2)
    expect(pa.getX(0)).toBe(10)
    expect(pa.getY(1)).toBe(40)
  })

  test('fromFlatArray with Float64Array', () => {
    const f = new Float64Array([1.5, 2.5, 3.5, 4.5])
    const pa = PointArray.fromFlatArray(f)
    expect(pa.length).toBe(2)
    expect(pa.getX(0)).toBe(1.5)
    expect(pa.getY(0)).toBe(2.5)
  })

  test('toPoints creates independent Point objects', () => {
    const pa = new PointArray()
    pa.push(1, 2)
    pa.push(3, 4)

    const points = pa.toPoints()
    expect(points.length).toBe(2)
    expect(points[0].x).toBe(1)
    expect(points[1].y).toBe(4)

    // modifying exported points does not affect array
    points[0].x = 999
    expect(pa.getX(0)).toBe(1)
  })

  test('toFloat64Array returns a view', () => {
    const pa = new PointArray()
    pa.push(1, 2)
    pa.push(3, 4)
    const view = pa.toFloat64Array()
    expect(view.length).toBe(4)
    expect(view[0]).toBe(1)
    expect(view[3]).toBe(4)
  })

  test('clear resets length', () => {
    const pa = new PointArray()
    pa.push(1, 2)
    pa.push(3, 4)
    pa.clear()
    expect(pa.length).toBe(0)
  })

  test('grows automatically beyond initial capacity', () => {
    const pa = new PointArray(2)
    for (let i = 0; i < 100; i++) {
      pa.push(i, i * 10)
    }
    expect(pa.length).toBe(100)
    expect(pa.getX(99)).toBe(99)
    expect(pa.getY(99)).toBe(990)
  })

  test('iterator yields indices', () => {
    const pa = new PointArray()
    pa.push(10, 20)
    pa.push(30, 40)
    pa.push(50, 60)

    const indices = [...pa]
    expect(indices).toEqual([0, 1, 2])
  })

  test('loop pattern: grab, mutate, write back', () => {
    const pa = new PointArray()
    pa.push(1, 2)
    pa.push(3, 4)
    pa.push(5, 6)

    // Translate all points by (10, 100) using a single scratch Point
    const scratch = new Point(0, 0)
    for (let i = 0; i < pa.length; i++) {
      pa.getPoint(i, scratch)
      scratch.x += 10
      scratch.y += 100
      pa.setPoint(i, scratch)
    }

    expect(pa.getX(0)).toBe(11)
    expect(pa.getY(0)).toBe(102)
    expect(pa.getX(2)).toBe(15)
    expect(pa.getY(2)).toBe(106)
  })

  test('mutable Point works with direct field access', () => {
    const p = new Point(3, 4)
    p.x = 10
    p.y = 20
    expect(p.x).toBe(10)
    expect(p.y).toBe(20)
    expect(p.length).toBe(Math.sqrt(500))
  })
})
