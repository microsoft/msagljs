import {Point} from '../../../src'
import {LineSegment, Polyline, GeomConstants} from '../../../src/math/geometry'
import {Polygon} from '../../../src/routing/visibility/Polygon'

test('more polygon dist', () => {
  const pls = GetPolylines()
  const point = new Point(373, 274)
  const ls = LineSegment.mkPP(point, new Point(314, 303))
  const pl5 = Polyline.mkFromPoints([ls.start, ls.end])
  //LayoutAlgorithmSettings.Show(pl0);
  for (const poly of pls) {
    const distInfo = Polygon.Distance(new Polygon(pl5), new Polygon(poly))
    const testDist = Polygon.TestPolygonDist(new Polygon(pl5), new Polygon(poly))
    expect(Math.abs(testDist - distInfo.dist) < 0.0001).toBe(true)
  }
})
test('almost two circles', () => {
  const rad = 10
  const n_corners = 20
  const center_a = new Point(0, 0)
  const center_b = new Point(2 * rad + 1, 0)
  let a = createCircle(center_a, rad, n_corners)
  let b = createCircle(center_b, rad, n_corners)
  let di = Polygon.Distance(a, b)
  TestDist(a, b, di.dist)
  const pts = circlePoints(n_corners, rad, center_a)
  const pa = new Polyline()
  for (let i = 0; i < pts.length; i++) {
    if (i == 3 || i == 9) continue
    pa.addPoint(pts[i])
  }
  a = new Polygon(pa)
  const pb = new Polyline()
  for (let i = 0; i < pts.length; i++) {
    if (i == 1 || i == 15) continue
    pb.addPoint(pts[i].add(new Point(2 * rad + 1, 2 * rad + 1).rotate(Math.PI / 10)))
  }
  b = new Polygon(pb)
  di = Polygon.Distance(a, b)
  TestDist(a, b, di.dist)
  expect(Math.abs(di.p.sub(di.q).length - di.dist) < GeomConstants.distanceEpsilon).toBe(true)
})
test('PolygonPolygonDistanceTest2', () => {
  const a = Polyline.mkFromPoints([
    new Point(-3397.10020369428, 993.94470736826),
    new Point(-3426.74057842555, 1014.3329144183),
    new Point(-3426.74057842555, 1045.96907990543),
    new Point(-3397.10020369428, 1066.35728695547),
    new Point(-3357.98527032, 1066.35728695547),
    new Point(-3328.34489558873, 1045.96907990543),
    new Point(-3328.34489558873, 1014.3329144183),
    new Point(-3357.98527032, 993.94470736826),
  ])

  const b = Polyline.mkFromPoints([new Point(-2588.08967113495, 1130.55203056335), new Point(-3327.46492624868, 1013.85788393446)])

  //DisplayGeometryGraph.ShowDebugCurves(new DebugCurve(100,1,"red",a),new DebugCurve(100,1,"blue",b));
  const pa = new Polygon(a)
  const pb = new Polygon(b)
  const dist0 = Polygon.Distance(pb, pa)
  TestDist(pb, pa, dist0.dist)
  const dist = Polygon.Distance(pa, pb)
  TestDist(pa, pb, dist.dist)
})
test(' PolygonPolygonDistance', () => {
  const a = new Polygon(
    Polyline.mkFromPoints([new Point(0, 0), new Point(0, 100), new Point(42, 109), new Point(100, 100), new Point(100, 0)]),
  )
  let b = new Polygon(Polyline.mkFromPoints([new Point(-2, 105), new Point(50, 130)]))
  let di = Polygon.Distance(a, b)
  TestDist(a, b, di.dist)

  // LayoutAlgorithmSettings.ShowDebugCurves(new DebugCurve(new LineSegment(p0,p1)), new DebugCurve("blue", poly0.Polyline), new DebugCurve("red",poly1.Polyline));
  b = new Polygon(Polyline.mkFromPoints([new Point(159, 60), new Point(91, 118)]))
  di = Polygon.Distance(b, a)
  TestDist(a, b, di.dist)

  b = new Polygon(Polyline.mkFromPoints([new Point(159, 60), new Point(140, 50), new Point(91, 118)]))
  di = Polygon.Distance(b, a)
  //  LayoutAlgorithmSettings.ShowDebugCurves(new DebugCurve(new LineSegment(p0, p1)),
  //    new DebugCurve("blue", a.Polyline), new DebugCurve("red", b.Polyline));

  TestDist(a, b, di.dist)
})
function TestDist(a: Polygon, b: Polygon, dist: number) {
  for (let i = 0; i < a.count; i++)
    for (let j = 0; j < b.count; j++) {
      const d = LineSegment.minDistBetweenLineSegments(a.pnt(i), a.pnt(i + 1), b.pnt(j), b.pnt(j + 1))
      expect(d.dist >= dist - 0.0000001).toBe(true)
    }
}
test('polygon dist', () => {
  const points = [new Point(0, 0), new Point(1, 1), new Point(2, 0), new Point(3, 0), new Point(3, 3), new Point(4, 1)]
  const p = new Polyline()
  p.addPoint(points[0])
  p.addPoint(points[1])
  p.addPoint(points[2])
  p.closed = true
  const q = new Polyline()
  q.addPoint(points[0 + 3])
  q.addPoint(points[1 + 3])
  q.addPoint(points[2 + 3])
  q.closed = true
  const P = new Polygon(p)
  const Q = new Polygon(q)
  const di = Polygon.Distance(P, Q)
  expect(di.dist).toBe(1)
})

function GetPolylines(): Polyline[] {
  const p0 = [223, 255, 172, 272, 129, 195, 174, 120, 217, 135, 282, 205]
  const p1 = [381, 194, 334, 196, 311, 181, 316, 128, 390, 156]
  const p2 = [559, 323, 491, 338, 428, 303, 451, 167, 560, 187]
  const p3 = [384, 453, 332, 401, 364, 365, 403, 400]
  const pl0 = Polyline.mkFromPoints(PointsFromData(p0))
  const pl1 = Polyline.mkFromPoints(PointsFromData(p1))
  const pl2 = Polyline.mkFromPoints(PointsFromData(p2))
  const pl3 = Polyline.mkFromPoints(PointsFromData(p3))
  return [pl0, pl1, pl2, pl3]
}

function PointsFromData(coords: number[]): Point[] {
  const r: Point[] = []
  for (let i = 0; i < coords.length - 1; i += 2) {
    r.push(new Point(coords[i], -coords[i + 1]))
  }
  return r
}

function createCircle(center: Point, radius: number, numOfPoints: number): Polygon {
  const pts = circlePoints(numOfPoints, radius, center)
  return Polygon.mkFromPoints(pts)
}

function circlePoints(numOfPoints: number, radius: number, center: Point) {
  const angle = Math.PI / numOfPoints
  const pts = []
  for (let i = 0; i < numOfPoints; i++) {
    const a = -i * angle
    pts.push(new Point(radius, 0).rotate(a).add(center))
  }
  return pts
}
