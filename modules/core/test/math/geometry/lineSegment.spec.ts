import {LineSegment, Point, GeomConstants} from '../../../src/math/geometry'
import {closeDistEps} from '../../../src/utils/compare'

test('lineSegment basic case', () => {
  const a = new LineSegment(0, 0, 1, 1)

  expect(a.value(0)).toStrictEqual(new Point(0, 0))
  expect(a.value(0)).toStrictEqual(a.start)
  expect(a.value(1)).toStrictEqual(a.end)
  expect(Point.close(a.value(0.5), a.start.add(a.end).div(2), GeomConstants.distanceEpsilon)).toBe(true)
  const t = 0.2
  expect(Point.close(a.value(t), a.start.add(a.end.sub(a.start).mul(t)), GeomConstants.distanceEpsilon)).toBe(true)
  const p0 = new Point(1, 1)
  const p1 = new Point(10, 10)
  const p2 = new Point(10, -10)
  const intersection = LineSegment.IntersectPPPP(p0, p1, p0, p2)
  expect(Point.close(intersection, p0, GeomConstants.distanceEpsilon)).toBe(true)
  const inters0 = LineSegment.IntersectPPPP(new Point(1, 1.1), p1, p0, p2)
  expect(inters0).toBe(undefined)
})
test('lineSegment mindist test 0', () => {
  const a = new Point(0, 0)
  const b = new Point(2, 4)
  const perp = b.sub(a).rotate(Math.PI / 2)
  const t = 0.2
  const ls = LineSegment.mkPP(a, b)
  const ls0start = ls.value(t).add(perp)

  const ls0dir = b.sub(a).rotate(0.1)
  const ls0 = LineSegment.mkPP(ls0start, ls0start.add(ls0dir))
  const md = LineSegment.minDistBetweenLineSegments(ls.start, ls.end, ls0.start, ls0.end)
  expect(closeDistEps(md.dist, perp.length)).toBe(true)
  expect(closeDistEps(md.parab, t)).toBeTruthy()
  expect(closeDistEps(md.parcd, 0)).toBeTruthy()
})
test('lineSegment mindist test1', () => {
  const a = new Point(0, 0)
  const b = new Point(2, 4)
  const perp = b.sub(a).rotate(Math.PI / 2)
  const t = 0.2
  const ls = LineSegment.mkPP(a, b)
  const ls0start = ls.value(t).add(perp)

  const ls0dir = b.sub(a).rotate(-0.001)
  const ls0 = LineSegment.mkPP(ls0start, ls0start.add(ls0dir))
  const md = LineSegment.minDistBetweenLineSegments(ls.start, ls.end, ls0.start, ls0.end)
  expect(md.dist < perp.length).toBeTruthy()
  expect(closeDistEps(md.parab, 1)).toBeTruthy()

  const lsPoint = ls.value(md.parab)
  const ls0Point = ls0.value(md.parcd)

  const minPerp = lsPoint.sub(ls0Point)

  expect(closeDistEps(minPerp.dot(ls0dir), 0)).toBeTruthy()
})

function getUniformMd(a: Point, b: Point, c: Point, d: Point): number {
  const n = 20
  const abDel = b.sub(a).div(n)
  const cdDel = d.sub(c).div(n)
  let dist = b.sub(c).length
  for (let i = 0; i <= n; i++) {
    const p = a.add(abDel.mul(i))
    for (let j = 0; j <= n; j++) {
      const q = c.add(cdDel.mul(j))
      const ndist = p.sub(q).length
      if (dist > ndist) dist = ndist
    }
  }
  return dist
}

test('lineSegment mindist uniform', () => {
  const a = new Point(0, 0)
  const b = new Point(2, 4.2)
  const c = new Point(1, 0)
  const d = new Point(2, 3)
  const md = LineSegment.minDistBetweenLineSegments(a, b, c, d)
  const uniformMd = getUniformMd(a, b, c, d)
  expect(md.dist <= uniformMd + GeomConstants.tolerance).toBeTruthy()
})

test('lineSegment mindist parallel', () => {
  const a = new Point(0, 0)
  const b = new Point(2, 4)
  const c = new Point(1, 1)
  const d = new Point(3, 4)
  const md = LineSegment.minDistBetweenLineSegments(a, b, c, d)
  const uniformMd = getUniformMd(a, b, c, d)
  expect(md.dist <= uniformMd + GeomConstants.tolerance).toBeTruthy()
})

test('lineSegment mindist parallel 0', () => {
  const a = new Point(0, 0)
  const b = new Point(2, 4)
  const c = new Point(1, 1)
  const d = new Point(3, 5)
  const md = LineSegment.minDistBetweenLineSegments(a, b, c, d)
  const uniformMd = getUniformMd(a, b, c, d)
  expect(md.dist <= uniformMd + GeomConstants.tolerance).toBeTruthy()
})

test('lineSegment mindist overlap', () => {
  const a = new Point(0, 0)
  const b = new Point(100, 100)
  const c = new Point(1, 2)
  const d = new Point(300, 300)
  const md = LineSegment.minDistBetweenLineSegments(a, b, c, d)
  const uniformMd = getUniformMd(a, b, c, d)
  expect(md.dist <= uniformMd + GeomConstants.tolerance).toBeTruthy()
})
