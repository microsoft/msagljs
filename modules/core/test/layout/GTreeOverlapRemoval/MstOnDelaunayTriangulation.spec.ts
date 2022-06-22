import {GeomNode, Point} from '../../../src'
import {GTreeOverlapRemoval} from '../../../src/layout/GTreeOverlapRemoval/GTreeOverlapRemoval'
import {MstOnDelaunayTriangulation} from '../../../src/layout/GTreeOverlapRemoval/MstOnDelaunayTriangulation'
import {CurveFactory, LineSegment} from '../../../src/math/geometry'
import {DebugCurve} from '../../../src/math/geometry/debugCurve'
import {Cdt} from '../../../src/routing/ConstrainedDelaunayTriangulation/Cdt'
import {CdtSweeper} from '../../../src/routing/ConstrainedDelaunayTriangulation/CdtSweeper'
import {initRandom, random, randomInt} from '../../../src/utils/random'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'

test('randomConfigs', () => {
  for (let i = 0; i < 200; i++) {
    RunOnRandom(i)
  }
})

function RunOnRandom(i: number) {
  initRandom(i)
  const ps = new Array<Point>()
  const count = randomInt(10) + 3
  for (let j = 0; j < count; j++) {
    ps.push(new Point(random(), random()).mul(10))
  }
  runOnPoints(ps)
}

test('gtree on CDT', () => {
  const count = 100
  const points = []
  for (let i = 0; i < count; i++) {
    points.push(new Point(random(), random()).mul(20))
  }

  const cdt = new Cdt(points, null, null)
  cdt.run()
  const redCurves = []
  for (const s of cdt.PointsToSites.values()) {
    for (const e of s.Edges) {
      if (e.upperSite.point.y < 0 || e.lowerSite.point.y < 0) {
        redCurves.push(LineSegment.mkPP(e.lowerSite.point, e.upperSite.point))
      }
    }
  }
  CdtSweeper.ShowCdt([...cdt.GetTriangles()], null, redCurves, null, [], '/tmp/mdsCdt.svg')
  const ret = MstOnDelaunayTriangulation.GetMstOnCdt(cdt, (e) => e.lowerSite.point.sub(e.upperSite.point).length)
  const l = []
  for (const s of cdt.PointsToSites.values()) {
    for (const e of s.Edges) {
      l.push(DebugCurve.mkDebugCurveTWCI(50, 0.1, 'black', LineSegment.mkPP(e.lowerSite.point, e.upperSite.point)))
    }
  }

  for (const e of ret) {
    l.push(DebugCurve.mkDebugCurveTWCI(100, 0.2, 'red', LineSegment.mkPP(e.lowerSite.point, e.upperSite.point)))
  }

  SvgDebugWriter.dumpDebugCurves('/tmp/mst.svg', l)
  //         LayoutAlgorithmSettings.ShowDebugCurvesEnumeration(l);
})
function runOnPoints(ps: Point[]) {
  const nodes = ps.map((p) => creatGeomNode(p))
  GTreeOverlapRemoval.RemoveOverlaps(nodes, 11)
}

function creatGeomNode(p: Point): any {
  const gn = new GeomNode(null)
  gn.boundaryCurve = CurveFactory.createRectangle(10, 10, p)
  return gn
}
