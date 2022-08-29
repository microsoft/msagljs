import {Point, CurveFactory, GeomNode, Node} from '../../../src'
import {Anchor} from '../../../src/layout/layered/anchor'
import {LineSegment, Curve, GeomConstants, Polyline} from '../../../src/math/geometry'
import {DebugCurve} from '../../../src/math/geometry/debugCurve'
import {IntersectionInfo} from '../../../src/math/geometry/intersectionInfo'
import {closeDistEps} from '../../../src/utils/compare'
import {SvgDebugWriter} from '../../utils/svgDebugWriter'

function paddingIsCorrectOnLineSeg(ls: LineSegment, anchor: Anchor, angle: number) {
  const xWithPadded = Curve.getAllIntersections(ls, anchor.polygonalBoundary, true)
  expect(xWithPadded.length).toBe(2)
  const xWithOrig = Curve.getAllIntersections(ls, anchor.node.boundaryCurve, true)
  const center = Point.middle(ls.start, ls.end)
  expect(xWithOrig.length).toBe(2)
  const ang = (angle * Math.PI) / 180
  fixIntersections(xWithPadded, center, ang)
  fixIntersections(xWithOrig, center, ang)

  withinPadding(xWithPadded[0].x.x, xWithOrig[0].x.x, anchor.padding)
  withinPadding(xWithOrig[1].x.x, xWithPadded[1].x.x, anchor.padding)
}

function withinPadding(a: number, b: number, padding: number) {
  const d = b - a
  expect(d >= padding - GeomConstants.intersectionEpsilon).toBe(true)
  expect(d <= 3 * padding).toBe(true)
}

function fixIntersections(xx: IntersectionInfo[], center: Point, ang: number) {
  for (const x of xx) {
    x.x = x.x.sub(center).rotate(-ang)
    expect(closeDistEps(x.x.y, 0)).toBe(true)
  }
  if (xx[0].x.x > xx[1].x.x) {
    const t = xx[0]
    xx[0] = xx[1]
    xx[1] = t
  }
}

function paddingIsCorrectForDirection(angle: number, anch: Anchor) {
  const l = anch.polygonalBoundary.boundingBox.diagonal
  const center = anch.polygonalBoundary.boundingBox.center
  const del = new Point(l, 0)
  // this line should cross anch.polygonalBoundary at two points
  let ls = LineSegment.mkPP(center.add(del), center.sub(del))
  ls = CurveFactory.rotateCurveAroundCenterByDegree(ls, center, angle) as LineSegment
  paddingIsCorrectOnLineSeg(ls, anch, angle)
}

function paddingIsCorrect(anchor: Anchor) {
  for (let i = 0; i < 180; i++) paddingIsCorrectForDirection(i, anchor)
}

test('anchor poly', () => {
  const boundary = CurveFactory.mkRectangleWithRoundedCorners(100, 50, 10, 30, new Point(12, 12))
  const n = GeomNode.mkNode(boundary, new Node('t'))
  const w = n.width / 2
  const h = n.height / 2
  const anchor = Anchor.mkAnchor(w, w, h, h, n, 0)
  const poly = anchor.polygonalBoundary
  expect(poly == null).toBe(false)
  const anchorPolyDC = DebugCurve.mkDebugCurveTWCI(200, 2, 'Green', poly)
  const anchorBC = DebugCurve.mkDebugCurveTWCI(200, 1, 'Brown', n.boundaryCurve)
  //SvgDebugWriter.dumpDebugCurves('/tmp/anchorBound.svg', [anchorPolyDC, anchorBC])
})

test('anchor poly padded', () => {
  const boundary = CurveFactory.mkRectangleWithRoundedCorners(100, 50, 10, 30, new Point(12, 12))
  const n = GeomNode.mkNode(boundary, new Node('t'))
  const w = n.width / 2
  const h = n.height / 2
  const anchor = Anchor.mkAnchor(w, w, h, h, n, 0)
  anchor.padding = 8
  const poly = anchor.polygonalBoundary
  expect(poly == null).toBe(false)
  //  SvgDebugWriter.dumpICurves('/tmp/anchorBoundPadded.svg', [poly, n.boundaryCurve])
  paddingIsCorrect(anchor)
})

test('anchor poly cw padded', () => {
  // clockwise triangle
  const boundary = Polyline.mkFromPoints([new Point(0, 0), new Point(50, 50), new Point(100, 0)])
  boundary.closed = true
  const n = GeomNode.mkNode(boundary, new Node('n'))
  const w = n.width / 2
  const h = n.height / 2
  const anchor = Anchor.mkAnchor(w, w, h, h, n, 0)
  anchor.padding = 8
  const poly = anchor.polygonalBoundary
  expect(poly == null).toBe(false)
  SvgDebugWriter.dumpICurves('/tmp/anchorCwBounded.svg', [poly, n.boundaryCurve])
  paddingIsCorrect(anchor)
})
