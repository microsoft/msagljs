import {Point} from '../../../../src'
import {Polyline} from '../../../../src/math/geometry'
import {TriangleOrientation} from '../../../../src/math/geometry/point'
import {LineSweeper} from '../../../../src/routing/spline/coneSpanner/LineSweeper'
import {VisibilityEdge} from '../../../../src/routing/visibility/VisibilityEdge'
import {VisibilityGraph} from '../../../../src/routing/visibility/VisibilityGraph'
import {PointSet} from '../../../../src/utils/PointSet'
import {initRandom, random} from '../../../../src/utils/random'
//import {SvgDebugWriter} from '../../../utils/svgDebugWriter'

test('two ports', () => {
  const obstacles: Polyline[] = null
  const direction = new Point(0, 1)
  const vg = new VisibilityGraph()
  const ports = new PointSet()
  ports.add(new Point(0, 0))
  ports.add(new Point(0.1, 10))
  const border: Polyline = null
  LineSweeper.Sweep(obstacles, direction, Math.PI / 6, vg, ports, border)

  expect(Array.from(vg.Edges).length).toBe(1)
})

test('three ports', () => {
  const obstacles: Polyline[] = null
  const direction = new Point(0, 1)
  const vg = new VisibilityGraph()
  const ports = new PointSet()
  ports.add(new Point(0, 0))
  ports.add(new Point(0.1, 10))
  ports.add(new Point(10, 10)) // out of the cone!
  const border: Polyline = null
  LineSweeper.Sweep(obstacles, direction, Math.PI / 6, vg, ports, border)

  expect(Array.from(vg.Edges).length).toBe(1)
})

test('two in a cone', () => {
  const obstacles: Polyline[] = null
  const direction = new Point(0, 1)
  const vg = new VisibilityGraph()
  const ports = new PointSet()
  ports.add(new Point(0, 0))
  ports.add(new Point(0.1, 10))
  ports.add(new Point(-0.1, 10)) //  in the same cone but further from the apex
  const border: Polyline = null
  LineSweeper.Sweep(obstacles, direction, Math.PI / 6, vg, ports, border)

  expect(Array.from(vg.Edges).length).toBe(1)
})

test('two in a Cone Larger Offset', () => {
  const obstacles = new Array<Polyline>()
  const direction = new Point(0, 1)
  const vg = new VisibilityGraph()
  const points = [new Point(0, 0), new Point(0.1, 10), new Point(-0.1, 20)]
  const ports = new PointSet()
  ports.add(points[0])
  ports.add(points[1])
  ports.add(points[2])
  const border: Polyline = null
  LineSweeper.Sweep(obstacles, direction, Math.PI / 6, vg, ports, border)
  expect(Array.from(vg.Edges).length).toBe(2)
  const orig = vg.FindVertex(points[0])
  const outOrig: Array<VisibilityEdge> = Array.from(orig.OutEdges.allNodes())
  expect(outOrig[0].TargetPoint.y).toBe(points[2].y)
  expect(outOrig.length).toBe(1)
  const v10 = vg.FindVertex(points[1])
  const outV10: Array<VisibilityEdge> = Array.from(v10.OutEdges.allNodes())
  expect(outV10.length).toBe(1)
  expect(outV10[0].TargetPoint.y).toBe(points[2].y)
})

test('RandomPorts', () => {
  for (let i = 0; i < 20; i++) {
    RunOnRandom(i)
  }
})
function RunOnRandom(i: number) {
  initRandom(i)
  const ps = new Array<Point>()
  for (let j = 0; j < 20; j++) {
    ps.push(new Point(random(), random()).mul(20))
  }

  const vg = new VisibilityGraph()
  const dir = new Point(0, 1)
  LineSweeper.Sweep(new Array<Polyline>(), dir, Math.PI / 6, vg, PointSet.mk(ps), null)
  CheckVG(vg, ps, dir)
  // SvgDebugWriter.dumpDebugCurves('/tmp/vg' + i + '.svg', getEdges())
  // function getEdges(): DebugCurve[] {
  //   const ret = []
  //   for (const e of vg.Edges) {
  //     ret.push(
  //       DebugCurve.mkDebugCurveTWCI(
  //         200,
  //         1,
  //         'green',
  //         LineSegment.mkPP(e.SourcePoint, e.TargetPoint),
  //       ),
  //     )
  //   }
  //   return ret
  // }
}

function CheckVG(vg: VisibilityGraph, ps: Array<Point>, dir: Point) {
  for (const p of ps) {
    CheckVGOnPoint(p, vg, ps, dir)
  }
}

function CheckVGOnPoint(p: Point, vg: VisibilityGraph, ps: Array<Point>, dir: Point) {
  const inCone = ps.filter((q) => p.equal(q) == false && InCone(p, q, dir, Math.PI / 6))
  const v = vg.FindVertex(p)
  expect((inCone.length == 0 && (v == null || (v.OutEdges.count == 0 && Array.from(v.InEdges).length > 0))) || v.OutEdges.count == 1).toBe(
    true,
  )
}

function InCone(apex: Point, q: Point, dir: Point, ang: number): boolean {
  return InConePPP(q, apex.add(dir.rotate(ang / 2)), apex, apex.add(dir.rotate(-ang / 2)))
}

function InConePPP(pi: Point, a: Point, b: Point, c: Point): boolean {
  // Assert.assert(
  //   Point.getTriangleOrientation(a, b, c) ==
  //     TriangleOrientation.Counterclockwise,
  // )
  return (
    Point.getTriangleOrientation(a, pi, b) == TriangleOrientation.Clockwise &&
    Point.getTriangleOrientation(b, pi, c) == TriangleOrientation.Clockwise
  )
}
