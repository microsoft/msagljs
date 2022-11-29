import {Curve, CurveFactory, ICurve, LineSegment, parameterSpan, Point, Rectangle, Size} from '../../../src/math/geometry'
import {BezierSeg} from '../../../src/math/geometry/bezierSeg'
import {clipWithRectangle, interpolateICurve} from '../../../src/math/geometry/curve'
import {DebugCurve} from '../../../src/math/geometry/debugCurve'
import {Ellipse} from '../../../src/math/geometry/ellipse'
import {PlaneTransformation} from '../../../src/math/geometry/planeTransformation'
import {closeDistEps} from '../../../src/utils/compare'
import {initRandom, randomInt} from '../../../src/utils/random'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'

//todo : test intersections of circle and curve on this data
/*
<svg xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" version="1.1" width="149.09678600915322" height="252.47784675796152">
    <g transform="translate(-885.0643062497131,-1083.9183194541174)">
        <path fill="none" stroke="Red" stroke-opacity="0.39215686274509803" stroke-width="1" d="M 971.8409328244938 1133.0447656223705 A 37.65018040652764,37.65018040652764 0 1 1 896.5405720114386 1133.0447656223705 A 37.65018040652764,37.65018040652764 0 1 1 971.8409328244938 1133.0447656223705"/>
        <path fill="none" stroke="Green" stroke-opacity="0.39215686274509803" stroke-width="1" d="M 1022.6848264971409 1324.9199004503535 L 1018.0480890677942 1320.4457949064035 A 24.192191266793948,24.192191266793948 0 0 1 1012.4731217463635 1312.239641054071 A 27.08054396992771,27.08054396992771 0 0 1 1010.4427152981107 1302.4855953302786 L 1010.1009653812305 1285.5883594020318 A 1388.1645465410347,1388.1645465410347 0 0 1 1009.9899612516147 1235.613848390693 A 808.9232937823946,808.9232937823946 0 0 1 1012.3204370466436 1185.7093380835745 L 1014.7617459311124 1154.2918508522832 A 6.397269741955042,6.397269741955042 180 0 0 1013.8466854034181 1150.4674463816712 A 3.719458061433423,3.719458061433423 180 0 0 1010.7054604649024 1148.6835596886774 L 971.7278815982831 1148.3164927562518 C970.2294156374242 1148.3023811228566 967.5273604789193 1146.7105975646675 966.1024089675566 1146.246795274553 L 946.3976438714379 1139.8331628773294 A 30.73930019020907,30.73930019020907 0 0 1 941.3918985150149 1137.697191100211 A 45.58485596585899,45.58485596585899 0 0 1 936.7473402376417 1134.8379857997509 L 924.8375065290029 1126.4842911012106"/>
        <path fill="none" stroke="Green" stroke-opacity="0.39215686274509803" stroke-width="1" d="M 1022.6848264971409 1324.9199004503535 L 1018.0480890677942 1320.4457949064035 A 24.192191266793948,24.192191266793948 0 0 1 1012.4731217463635 1312.239641054071 A 27.08054396992771,27.08054396992771 0 0 1 1010.4427152981107 1302.4855953302786 L 1010.1009653812305 1285.5883594020318 A 1388.1645465410347,1388.1645465410347 0 0 1 1009.9899612516147 1235.613848390693 A 808.9232937823946,808.9232937823946 0 0 1 1012.3204370466436 1185.7093380835745 L 1014.7617459311124 1154.2918508522832 A 6.397269741955042,6.397269741955042 180 0 0 1013.8466854034181 1150.4674463816712 A 3.719458061433423,3.719458061433423 180 0 0 1010.7054604649024 1148.6835596886774 L 971.7278815982831 1148.3164927562518 C970.2294156374242 1148.3023811228566 967.5273604789193 1146.7105975646675 966.1024089675566 1146.246795274553 L 946.3976438714379 1139.8331628773294 A 30.73930019020907,30.73930019020907 0 0 1 941.3918985150149 1137.697191100211 A 45.58485596585899,45.58485596585899 0 0 1 936.7473402376417 1134.8379857997509 L 924.8375065290029 1126.4842911012106"/>
    </g>
</svg>
*/

test('polylineAroundClosedCurve', () => {
  const c = CurveFactory.mkRectangleWithRoundedCorners(100, 50, 15, 15, new Point(0, 0))
  const pc = Curve.polylineAroundClosedCurve(c)
  expect(Point.closeDistEps(pc.boundingBox.center, c.boundingBox.center)).toBe(true)
  SvgDebugWriter.dumpICurves('./tmp/polylineAroundClosedCurve.svg', [c, pc])
})

test('adjustStartEndEndParametersToDomain', () => {
  const c = new Curve()
  c.addSegment(LineSegment.mkPP(new Point(0, 0), new Point(1, 2)))
  const params = {start: 0.9, end: 0.1}
  c.adjustStartEndEndParametersToDomain(params)
  expect(params.end).toBeGreaterThan(params.start)
})
test('trimWithWrap', () => {
  const c = CurveFactory.mkRectangleWithRoundedCorners(100, 100, 5, 5, new Point(0, 0))
  const trimResult = c.trimWithWrap((c.parStart + c.parEnd) / 2, c.parStart * 0.6 + c.parEnd * 0.4)
  SvgDebugWriter.dumpICurves('./tmp/trimWithWrap.svg', [trimResult])
})

test('tail', () => {
  const a = [1, 2, 3]
  const b = a.slice(1)

  expect(b[0]).toBe(a[1])
})
test('interpolate', () => {
  const ls = LineSegment.mkPP(new Point(0, 0), new Point(100, 0))
  let ps = interpolateICurve(ls, 1)
  expect(ps.length).toBe(2)
  expect(ps[0].equal(ls.start)).toBe(true)
  expect(ps[1].equal(ls.end)).toBe(true)

  const b = [new Point(0, 100), new Point(100, 100), new Point(200, 10), new Point(300, 0)]
  const bezSeg = new BezierSeg(b[0], b[1], b[2], b[3])
  ps = interpolateICurve(bezSeg, 1)
  for (let i = 0; i < ps.length - 1; i++) {
    expect(ps[i].equal(ps[i + 1])).toBe(false) // no duplicates
  }
  expect(ps[ps.length - 1].equal(b[3])).toBe(true)
})

function intersectOnDiameter(a: Point, b: Point) {
  const ls = LineSegment.mkPP(a, b)
  const circ = Ellipse.mkCircle(b.sub(a).length / 2, Point.middle(a, b))
  let xx = Curve.getAllIntersections(ls, circ, false)
  expect(xx.length === 2).toBeTruthy()
  expect(closeDistEps(xx[0].x.sub(xx[1].x).length, b.sub(a).length)).toBeTruthy()
  for (const x of xx) {
    expect(Point.closeDistEps(x.x, a) || Point.closeDistEps(x.x, b)).toBeTruthy()
  }
  const rad = ls.length / 2
  ls.translate(new Point(0, rad))
  xx = Curve.getAllIntersections(ls, circ, false)
  expect(xx.length > 0 && xx.length <= 2).toBeTruthy()
}

function bbIsOk(s: ICurve) {
  const bbox = s.boundingBox.clone()
  const n = 20
  const del = Curve.paramSpan(s) / n
  const rect = Rectangle.mkEmpty()
  for (let i = 0; i < n; i++) {
    const v = s.value(Math.min(s.parStart + i * del, s.parEnd))
    expect(bbox.contains(v)).toBe(true)
    rect.add(v)
  }
  expect(bbox.contains(rect.leftBottom)).toBe(true)
  expect(bbox.contains(rect.rightTop)).toBe(true)
  rect.pad(rect.diagonal / 10)
  expect(rect.contains(bbox.leftBottom)).toBe(true)
  expect(rect.contains(bbox.rightTop)).toBe(true)
}

test('trim', () => {
  const curve = new Curve()
  const a = new Point(0, 0)
  const b = new Point(1, 0)
  const c = new Point(4, 0)
  const d = new Point(4, 2)
  const e = new Point(5, 5)
  curve.addSegment(LineSegment.mkPP(a, b))
  curve.addSegment(LineSegment.mkPP(b, c))
  curve.addSegment(LineSegment.mkPP(c, d))
  curve.addSegment(LineSegment.mkPP(d, e))
  const t = curve.trim(0.5, 3.5)
  expect((t as Curve).segs.length).toBe(4)
})

test('box translate behavior', () => {
  const ell = new Ellipse(Math.PI / 3, Math.PI / 2, new Point(100, 0), new Point(0, 100), new Point(0, 0))
  const b = [new Point(0, 100), new Point(100, 100), new Point(200, 10), new Point(300, 0)]
  const bezSeg = new BezierSeg(b[0], b[1], b[2], b[3])
  const ls = LineSegment.mkPP(b[0], b[1])
  const rr: Curve = CurveFactory.mkRectangleWithRoundedCorners(100, 52, 7, 7, new Point(0, 0))
  const t = [ell, bezSeg, ls, rr]
  for (const s of t) {
    bbIsOk(s)
    s.translate(new Point(10, 32))
    bbIsOk(s)
  }
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function intersectTwoRoundedRects(rr: Curve, rr0: Curve, i: number): void {
  const xx = Curve.getAllIntersections(rr, rr0, true)
  // const xxD = xx.map((x) =>
  //  DebugCurve.mkDebugCurveWCI(0.5, 'Red', CurveFactory.mkCircle(3, x.x)),
  // )
  // xxD.push(DebugCurve.mkDebugCurveI(rr))
  // xxD.push(DebugCurve.mkDebugCurveI(rr0))
  // const svgW = // SvgDebugWriter.writeGeomGraph('./tmp/rr' + i + '.svg',
  // svgW.writeDebugCurves(xxD)
  // svgW.close()
  expect(xx.length % 2).toBe(0)
}

test('intersect rounded rect rotated', () => {
  const rr: Curve = CurveFactory.mkRectangleWithRoundedCorners(100, 52, 5, 7, new Point(0, 0))
  const center = rr.boundingBox.center
  for (let i = 1; i <= 90; i++) {
    const rc = CurveFactory.rotateCurveAroundCenterByDegree(rr.clone(), center, i)
    intersectTwoRoundedRects(rr, rc as Curve, i)
  }
})

test('curve intersect line circle', () => {
  const a = new Point(1, 0)
  const b = new Point(2, 0)
  intersectOnDiameter(a, b)
  const degree = Math.PI / 180
  for (let i = 0; i < 90; i++) {
    const angle = i * degree
    const m = PlaneTransformation.rotation(angle)
    const ac = m.multiplyPoint(a)
    const bc = m.multiplyPoint(b)
    intersectOnDiameter(ac, bc)
  }
})

test('bezier rounded rect intersections', () => {
  const rr: Curve = CurveFactory.mkRectangleWithRoundedCorners(100, 52, 7, 7, new Point(0, 0))
  const center = rr.boundingBox.center
  const outsidePoint = center.add(new Point(rr.boundingBox.width, rr.boundingBox.height))
  const dir = outsidePoint.sub(center)
  const perp = dir.div(3).rotate90Cw()
  const bezSeg = BezierSeg.mkBezier([
    center,
    Point.convSum(1 / 3, center, outsidePoint).add(perp),
    Point.convSum(2 / 3, center, outsidePoint).sub(perp),
    outsidePoint,
  ])
  for (let i = 1; i <= 190; i++) {
    const rc = CurveFactory.rotateCurveAroundCenterByDegree(bezSeg.clone(), center, i)
    const xx = Curve.getAllIntersections(rr, rc, true)
    expect(xx.length > 0 && xx.length % 2 !== 0).toBe(true)
  }
}, 10)
test('ClosestPoint', () => {
  const rr: Curve = CurveFactory.mkRectangleWithRoundedCorners(100, 52, 7, 7, new Point(0, 0))
  const p = Curve.ClosestPoint(rr, new Point(11, 150))

  expect(Point.closeDistEps(p, new Point(11, 26))).toBe(true)
})

test('line curve intersections', () => {
  const rr: Curve = CurveFactory.mkRectangleWithRoundedCorners(100, 52, 7, 7, new Point(0, 0))
  const ls = LineSegment.mkPP(new Point(1000, 1000), new Point(2000, 2000))
  const xx = Curve.getAllIntersections(ls, rr, false)
  expect(xx.length).toBe(0)
})

test('bezier bezier rect intersections', () => {
  const a = new Point(0, 0)
  const b = new Point(122, 100)
  const dir = b.sub(a)
  const perp = dir.div(3).rotate90Cw()
  const bezSeg = BezierSeg.mkBezier([a, Point.convSum(1 / 3, a, b).add(perp), Point.convSum(2 / 3, a, b).sub(perp), b])
  for (let i = 1; i < 90; i++) {
    const rc = CurveFactory.rotateCurveAroundCenterByDegree(bezSeg.clone(), bezSeg.boundingBox.center, i)
    const xx = Curve.getAllIntersections(bezSeg, rc, true)
    expect(xx.length > 0).toBe(true)
  }
  // exp(false);
})
test('clipWithRect random', () => {
  const w = 300
  const h = 200
  let n = 40000
  initRandom(0)
  for (; n > 0; n--) {
    const line = getLineSeg(w, h)
    const rect = getRect(w, h)
    const inters = Array.from(clipWithRectangle(line, rect))
    const t = naiveInters(line, rect)
    if (!t) continue
    expect(inters.length > 0).toBe(true)
  }
})
function naiveInters(c: ICurve, rect: Rectangle): boolean {
  const n = 100
  const del = parameterSpan(c) / n

  for (let i = 0; i <= n; i++) {
    const p = c.value(c.parStart + i * del)
    if (rect.contains_point(p)) {
      return true
    }
  }
  return false
}
function getRect(w: number, h: number): Rectangle {
  return Rectangle.mkPP(getPoint(w, h), getPoint(w, h))
}

function getLineSeg(w: number, h: number): ICurve {
  return LineSegment.mkPP(getPoint(w, h), getPoint(w, h))
}
function getPoint(w: number, h: number): Point {
  return new Point(randomInt(w), randomInt(h))
}
test('clipWithRect', () => {
  const rect = Rectangle.mkSizeCenter(new Size(20, 20), new Point(0, 0))
  const circle = CurveFactory.mkCircle(rect.width / 2 + 2, new Point(0, 0))
  let clip = Array.from(clipWithRectangle(circle, rect))
  SvgDebugWriter.dumpDebugCurves(
    './tmp/clip_1.svg',
    [DebugCurve.mkDebugCurveTWCI(100, 1, 'black', rect.perimeter()), DebugCurve.mkDebugCurveTWCI(100, 1, 'Red', circle)].concat(
      clip.map((c) => DebugCurve.mkDebugCurveTWCI(100, 2, 'Green', c)),
    ),
  )
  expect(clip.length).toBeGreaterThanOrEqual(4)
  clip = Array.from(clipWithRectangle(LineSegment.mkPP(new Point(0, 0), new Point(100, 10)), rect))
  //expect(clip.length).toBe(1)
  //expect(closeDistEps(clip[0].end.x, rect.right)).toBe(true)
  SvgDebugWriter.dumpDebugCurves(
    './tmp/clip0.svg',
    [DebugCurve.mkDebugCurveTWCI(100, 1, 'black', rect.perimeter()), DebugCurve.mkDebugCurveTWCI(100, 1, 'Red', circle)].concat(
      clip.map((c) => DebugCurve.mkDebugCurveTWCI(100, 2, 'Green', c)),
    ),
  )
  circle.translate(new Point(2, 0))
  clip = Array.from(clipWithRectangle(circle, rect))
  SvgDebugWriter.dumpDebugCurves(
    './tmp/clip1.svg',
    [DebugCurve.mkDebugCurveTWCI(100, 1, 'black', rect.perimeter()), DebugCurve.mkDebugCurveTWCI(100, 1, 'Red', circle)].concat(
      clip.map((c) => DebugCurve.mkDebugCurveTWCI(100, 2, 'Green', c)),
    ),
  )
  // expect(clip.length).toBeGreaterThan(4)
  circle.translate(new Point(2, 0))
  clip = Array.from(clipWithRectangle(circle, rect))
  SvgDebugWriter.dumpDebugCurves(
    './tmp/clip2.svg',
    [DebugCurve.mkDebugCurveTWCI(100, 1, 'black', rect.perimeter()), DebugCurve.mkDebugCurveTWCI(100, 1, 'Red', circle)].concat(
      clip.map((c) => DebugCurve.mkDebugCurveTWCI(100, 2, 'Green', c)),
    ),
  )
  // expect(clip.length).toBeGreaterThanOrEqual(1)
})
