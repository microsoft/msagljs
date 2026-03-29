import {Point} from '../../src/math/geometry/point'
import {Polyline} from '../../src/math/geometry/polyline'
import {Rectangle} from '../../src/math/geometry/rectangle'
import {Cdt} from '../../src/routing/ConstrainedDelaunayTriangulation/Cdt'
import {corridorRoute, findContainingTriangle} from '../../src/routing/corridorRouter'

/** Create a rectangular obstacle polyline */
function rect(x: number, y: number, w: number, h: number): Polyline {
  const p = new Polyline()
  p.addPoint(new Point(x, y))
  p.addPoint(new Point(x + w, y))
  p.addPoint(new Point(x + w, y + h))
  p.addPoint(new Point(x, y + h))
  p.closed = true
  return p
}

/** Build a CDT with obstacles and a bounding box (like SplineRouter does) */
function buildCdt(obstacles: Polyline[], ports: Point[] = []): Cdt {
  const bb = Rectangle.mkEmpty()
  for (const obs of obstacles) {
    bb.addRecSelf(obs.boundingBox)
  }
  for (const p of ports) {
    bb.add(p)
  }
  bb.pad(Math.max(bb.diagonal / 4, 10))
  const allObs = [...obstacles, bb.perimeter()]
  const cdt = new Cdt(ports, allObs, [])
  cdt.run()
  return cdt
}

describe('corridorRouter', () => {
  test('findContainingTriangle finds correct triangle', () => {
    const obstacles = [rect(3, 3, 2, 2)]
    const cdt = buildCdt(obstacles)

    // point outside the obstacle
    const tri = findContainingTriangle(cdt, new Point(0, 0))
    expect(tri).not.toBeNull()
    expect(tri.containsPoint(new Point(0, 0))).toBe(true)
  })

  test('route around a single obstacle', () => {
    const obstacle = rect(4, 3, 2, 4)
    const cdt = buildCdt([obstacle])

    const source = new Point(1, 5)
    const target = new Point(9, 5)
    const poly = corridorRoute(cdt, source, target)

    expect(poly).not.toBeNull()
    expect(poly.start.equal(source)).toBe(true)
    expect(poly.end.equal(target)).toBe(true)
    expect(poly.count).toBeGreaterThanOrEqual(2)
  })

  test('straight line when no obstacle between source and target', () => {
    const obstacles = [rect(0, 8, 10, 2), rect(0, 0, 10, 2)]
    const cdt = buildCdt(obstacles)

    const source = new Point(1, 5)
    const target = new Point(9, 5)
    const poly = corridorRoute(cdt, source, target)

    expect(poly).not.toBeNull()
    expect(poly.count).toBeGreaterThanOrEqual(2)
  })

  test('route between two obstacles', () => {
    const obs1 = rect(3, 0, 2, 4)
    const obs2 = rect(3, 6, 2, 4)
    const cdt = buildCdt([obs1, obs2])

    const source = new Point(0, 5)
    const target = new Point(8, 5)
    const poly = corridorRoute(cdt, source, target)

    expect(poly).not.toBeNull()
  })

  test('route with source/target inside allowed obstacles', () => {
    const obs1 = rect(0, 0, 4, 4)
    const obs2 = rect(8, 0, 4, 4)
    const middle = rect(5, 1, 1, 2)
    const cdt = buildCdt([obs1, obs2, middle])

    const source = new Point(2, 2) // inside obs1
    const target = new Point(10, 2) // inside obs2
    const poly = corridorRoute(cdt, source, target, obs1, obs2)

    expect(poly).not.toBeNull()
    expect(poly.start.equal(source)).toBe(true)
    expect(poly.end.equal(target)).toBe(true)
  })

  test('multiple obstacles maze-like', () => {
    const obstacles = [
      rect(3, 0, 1, 6),
      rect(6, 4, 1, 6),
      rect(9, 0, 1, 6),
    ]
    const cdt = buildCdt(obstacles)

    const source = new Point(0, 5)
    const target = new Point(12, 5)
    const poly = corridorRoute(cdt, source, target)

    expect(poly).not.toBeNull()
    expect(poly.start.equal(source)).toBe(true)
    expect(poly.end.equal(target)).toBe(true)
    expect(poly.count).toBeGreaterThan(2)
  })
})
