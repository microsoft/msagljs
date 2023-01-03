import {Point, Rectangle} from '../../../src'
import {LineSegment, Polyline} from '../../../src/math/geometry'
import {PlaneTransformation} from '../../../src/math/geometry/planeTransformation'
import {Cdt} from '../../../src/routing/ConstrainedDelaunayTriangulation/Cdt'
import {CdtSite} from '../../../src/routing/ConstrainedDelaunayTriangulation/CdtSite'
import {InCircle, CdtSweeper} from '../../../src/routing/ConstrainedDelaunayTriangulation/CdtSweeper'
import {CdtTriangle} from '../../../src/routing/ConstrainedDelaunayTriangulation/CdtTriangle'
import {SymmetricTuple} from '../../../src/structs/SymmetricTuple'

test('cdt inCircle ', () => {
  let a = new CdtSite(new Point(0, 0))
  let b = new CdtSite(new Point(2, 0))
  let c = new CdtSite(new Point(1, 2))
  let s = new CdtSite(new Point(1, 1))
  expect(InCircle(s, a, b, c)).toBe(true)
  MoveSites(a, b, c, s)
  expect(InCircle(s, a, b, c)).toBe(true)
  RotateSites(a, b, c, s)
  expect(InCircle(s, a, b, c)).toBe(true)
  a = new CdtSite(new Point(0, 0))
  b = new CdtSite(new Point(2, 0))
  c = new CdtSite(new Point(1, 2))
  s = new CdtSite(new Point(1, -1))
  expect(!InCircle(s, a, b, c)).toBe(true)
  MoveSites(a, b, c, s)
  expect(!InCircle(s, a, b, c)).toBe(true)
  RotateSites(a, b, c, s)
  expect(!InCircle(s, a, b, c)).toBe(true)
  a = new CdtSite(new Point(0, 0))
  b = new CdtSite(new Point(1, 0))
  c = new CdtSite(new Point(5, 5))
  s = new CdtSite(new Point(3, 1))
  expect(InCircle(s, a, b, c)).toBe(true)
  MoveSites(a, b, c, s)
  expect(InCircle(s, a, b, c)).toBe(true)
  RotateSites(a, b, c, s)
  expect(InCircle(s, a, b, c)).toBe(true)
  expect(InCircle(s, c, a, b)).toBe(true)
  a = new CdtSite(new Point(0, 0))
  b = new CdtSite(new Point(1, 0))
  c = new CdtSite(new Point(5, 5))
  s = new CdtSite(new Point(4, 1))
  expect(!InCircle(s, a, b, c)).toBe(true)
  MoveSites(a, b, c, s)
  expect(!InCircle(s, a, b, c)).toBe(true)
  RotateSites(a, b, c, s)
  expect(!InCircle(s, a, b, c)).toBe(true)
  a = new CdtSite(new Point(0, 0))
  b = new CdtSite(new Point(1, 0))
  c = new CdtSite(new Point(5, 5))
  s = new CdtSite(new Point(3, 0.5))
  expect(!InCircle(s, a, b, c)).toBe(true)
  MoveSites(a, b, c, s)
  expect(!InCircle(s, a, b, c)).toBe(true)
  RotateSites(a, b, c, s)
  expect(!InCircle(s, a, b, c)).toBe(true)
  expect(!InCircle(s, c, a, b)).toBe(true)
})

function RotateSites(a: CdtSite, b: CdtSite, c: CdtSite, s: CdtSite) {
  const angle = Math.PI / 3
  a.point = a.point.rotate(angle)
  b.point = b.point.rotate(angle)
  c.point = c.point.rotate(angle)
  s.point = s.point.rotate(angle)
}

function MoveSites(a: CdtSite, b: CdtSite, c: CdtSite, s: CdtSite) {
  const del = new Point(20, -30)
  a.point = a.point.add(del)
  b.point = b.point.add(del)
  c.point = c.point.add(del)
  s.point = s.point.add(del)
}

test('TriangleCreationTest', () => {
  const a = new CdtSite(new Point(0, 0))
  const b = new CdtSite(new Point(2, 0))
  const c = new CdtSite(new Point(1, 2))
  const tri = CdtTriangle.mkSSSD(a, b, c, Cdt.GetOrCreateEdge)
  let e = tri.Edges.getItem(0)
  expect(e.upperSite === a).toBe(true)
  expect(e.lowerSite === b).toBe(true)
  expect(e.CcwTriangle === tri && e.CwTriangle == null).toBe(true)

  e = tri.Edges.getItem(1)
  expect(e.upperSite === c).toBe(true)
  expect(e.lowerSite === b).toBe(true)
  expect(e.CwTriangle === tri && e.CcwTriangle == null).toBe(true)

  e = tri.Edges.getItem(2)
  expect(e.upperSite === c).toBe(true)
  expect(e.lowerSite === a).toBe(true)
  expect(e.CcwTriangle === tri && e.CwTriangle == null).toBe(true)

  const tri0 = CdtTriangle.mkSED(new CdtSite(new Point(2, 2)), tri.Edges.getItem(1), Cdt.GetOrCreateEdge)
  expect(tri0.Edges.getItem(0) === tri.Edges.getItem(1)).toBe(true)
  expect(tri.Edges.getItem(1).CcwTriangle != null && tri.Edges.getItem(1).CwTriangle != null).toBe(true)
})

test('SmallTriangulation', () => {
  // #if TEST_MSAGL&& TEST_MSAGL
  //            GraphViewerGdi.DisplayGeometryGraph.SetShowFunctions();
  // #endif
  const isolatedObstacles = [
    new SymmetricTuple<Point>(new Point(109, 202), new Point(506, 135)),
    new SymmetricTuple<Point>(new Point(139, 96), new Point(452, 96)),
  ]
  const cdt = new Cdt(Array.from(Points()), null, isolatedObstacles)
  cdt.run()
  CdtSweeper.ShowCdt(
    [...cdt.GetTriangles().values()],
    null,
    isolatedObstacles.map((s) => LineSegment.mkPP(s.A, s.B)),
    null,
    [],
    './tmp/smallTriangulationTest.svg',
  )
})

function* Points() {
  for (const segment of Segments()) {
    yield segment.A
    yield segment.B
  }
  yield new Point(157, 198)
}

function* Segments() {
  yield new SymmetricTuple<Point>(new Point(181, 186), new Point(242, 73))
  yield new SymmetricTuple<Point>(new Point(236, 122), new Point(268, 202))
  yield new SymmetricTuple<Point>(new Point(274, 167), new Point(343, 76))
  yield new SymmetricTuple<Point>(new Point(352, 131), new Point(361, 201))
  yield new SymmetricTuple<Point>(new Point(200, 209), new Point(323, 237))
  yield new SymmetricTuple<Point>(new Point(372, 253), new Point(451, 185))
  yield new SymmetricTuple<Point>(new Point(448, 133), new Point(517, 272))
  yield new SymmetricTuple<Point>(new Point(339, 327), new Point(327, 145))
  yield new SymmetricTuple<Point>(new Point(185, 220), new Point(207, 172))
  yield new SymmetricTuple<Point>(new Point(61, 226), new Point(257, 253))
  yield new SymmetricTuple<Point>(new Point(515, 228), new Point(666, 258))
}

test('two holes and one isolated segment', () => {
  for (let i = 0; i < 90; i++) {
    // i < 90 todo
    const ang = (Math.PI / 360) * i
    const corners = [
      new Point(0, 0).rotate(ang),
      new Point(100, 0).rotate(ang),
      new Point(100, 100).rotate(ang),
      new Point(0, 100).rotate(ang),
    ]
    const triangle = new Polyline()
    triangle.addPoint(new Point(35.0, 50).rotate(ang))
    triangle.addPoint(new Point(40, 31).rotate(ang))
    triangle.addPoint(new Point(30, 30).rotate(ang))
    triangle.closed = true

    const holes = [Rectangle.mkPP(new Point(10, 10).rotate(ang), new Point(20, 20).rotate(ang)).perimeter(), triangle]
    const cut = [new SymmetricTuple<Point>(new Point(80, 80).rotate(ang), new Point(90, 75).rotate(ang))]
    const cdt = new Cdt(corners, holes, cut)
    cdt.run()
    // CdtSweeper.ShowCdt(
    //  [...cdt.GetTriangles()],
    //  null,
    //  from(holes),
    //  from(cut).select((c) => LineSegment.mkPP(c.A, c.B)),
    //  './tmp/twoHoles' + i + '.svg',
    // )
  }
})

test('three holes and two isolated segments', () => {
  for (let i = 0; i <= 90; i++) {
    const ang = (Math.PI / 360) * i
    const corners = [
      new Point(0, 0).rotate(ang),
      new Point(100, 0).rotate(ang),
      new Point(100, 100).rotate(ang),
      new Point(0, 100).rotate(ang),
    ]
    const triangle = new Polyline()
    triangle.addPoint(new Point(35.0, 50).rotate(ang))
    triangle.addPoint(new Point(40, 31).rotate(ang))
    triangle.addPoint(new Point(30, 30).rotate(ang))
    triangle.closed = true

    const trans = PlaneTransformation.rotation(ang)

    const rect = Rectangle.mkPP(new Point(10, 10), new Point(20, 20)).perimeter().transform(trans) as unknown as Polyline
    const anotherRect = rect.clone() as unknown as Polyline
    anotherRect.translate(new Point(-1, -20).rotate(ang))

    const holes = [rect, triangle, anotherRect]
    const cut = [
      new SymmetricTuple<Point>(new Point(80, 80).rotate(ang), new Point(90, 75).rotate(ang)),
      new SymmetricTuple<Point>(new Point(80, 75).rotate(ang), new Point(90, 70).rotate(ang)),
    ]
    const cdt = new Cdt(Array.from(corners), holes, cut)
    cdt.run()
    // CdtSweeper.ShowCdt(
    //  [...cdt.GetTriangles()],
    //  null,
    //  from(holes),
    //  from(cut).select((c) => LineSegment.mkPP(c.A, c.B)),
    //  './tmp/threeHoles.svg',
    // )
  }
})
test('flat line', () => {
  const corners = []

  for (let i = 0; i < 4; i++) {
    corners.push(new Point(10 * i, 0))
  }

  const cdt = new Cdt(Array.from(corners), null, null)
  cdt.run()
  CdtSweeper.ShowCdt([...cdt.GetTriangles()], null, null, null, [], './tmp/flatLine.svg')
})
test('grid rotated', () => {
  for (let k = 0; k < 6; k++) {
    const corners = []

    const ang = (k * Math.PI) / 6
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        corners.push(new Point(10 * i, 10 * j).rotate(ang))
      }
    }
    const cdt = new Cdt(Array.from(corners), null, null)
    cdt.run()
    CdtSweeper.ShowCdt([...cdt.GetTriangles()], null, null, null, [], './tmp/gridRotated' + k + '.svg')
  }
})
