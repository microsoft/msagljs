import {Queue} from 'queue-typescript'
import {SvgDebugWriter} from '../../../test/utils/svgDebugWriter'
import {CurveFactory, GeomConstants, LineSegment, Point, Polyline} from '../../math/geometry'
import {DebugCurve} from '../../math/geometry/debugCurve'
import {PolylinePoint} from '../../math/geometry/polylinePoint'
import {Assert} from '../../utils/assert'
import {PointMap} from '../../utils/PointMap'
import {Cdt} from '../ConstrainedDelaunayTriangulation/Cdt'
import {CdtEdge} from '../ConstrainedDelaunayTriangulation/CdtEdge'
import {CdtSite} from '../ConstrainedDelaunayTriangulation/CdtSite'
import {CdtTriangle} from '../ConstrainedDelaunayTriangulation/CdtTriangle'
import {CdtThreader} from './bundling/CdtThreader'
/** Optimize path locally, without changing its topology.
 * The obstacles are represented by constrained edges of cdd, the Delaunay triangulation.
 * It is assumed that the polyline passes only through the sites of the cdt.
 */
let debCount = 0
export class PathOptimizer {
  cdt: Cdt
  poly: Polyline
  sourcePoly: Polyline
  targetPoly: Polyline
  constructor(cdt: Cdt) {
    this.cdt = cdt
    cdt.SetInEdges()
  }
  triangles = new Set<CdtTriangle>()
  findTrianglesIntersectingThePolyline() {
    if (this.poly.count <= 2) return
    Assert.assert(this.poly.count >= 4)
    this.sourcePoly = this.cdt.PointsToSites.get(this.poly.startPoint.next.point).Owner as Polyline
    this.targetPoly = this.cdt.PointsToSites.get(this.poly.endPoint.prev.point).Owner as Polyline
    this.addLineSeg(this.poly.startPoint.next, this.poly.start)
    for (let p = this.poly.startPoint.next; p != this.poly.endPoint.prev; p = p.next) {
      this.addLineSeg(p, p.next.point)
    }
    this.addLineSeg(this.poly.endPoint.prev, this.poly.end)
  }
  addLineSeg(pp: PolylinePoint, end: Point) {
    const site = this.cdt.PointsToSites.get(pp.point)
    const q = new Queue<CdtTriangle>()
    const t = site.Edges[0].CcwTriangle
    const trs = new Set<CdtTriangle>()
    q.enqueue(t)
    trs.add(t)
    while (q.length > 0) {
      const t = q.dequeue()
      this.addToTriangles(t)
      for (const e of t.TriEdges) {
        const ot = e.GetOtherTriangle_T(t)
        if (trs.has(ot)) continue
        if (ot.intersectsLine(site.point, end)) {
          q.enqueue(ot)
          trs.add(ot)
        }
      }
    }
  }
  private addToTriangles(t: CdtTriangle) {
    const owner = t.Sites.item0.Owner
    if (owner === this.sourcePoly || owner === this.targetPoly || !triangIsInsideOfObstacle(t)) {
      this.triangles.add(t)
    }
  }

  run(poly: Polyline): void {
    this.poly = poly
    if (this.poly.count <= 2) return
    Assert.assert(this.poly.count >= 4)
    this.findTrianglesIntersectingThePolyline()

    const perimeter = this.getPerimeterEdges()
    const perimeterPoly = this.getPerimeterPoly(perimeter)
    const dc = getDebugCurvesFromEdgesAndCdt(this.poly, this.cdt)
    for (let pp = perimeterPoly.startPoint; pp.next; pp = pp.next) {
      dc.push(DebugCurve.mkDebugCurveTWCI(200, 1, 'Black', LineSegment.mkPP(pp.point, pp.next.point)))
    }

    SvgDebugWriter.dumpDebugCurves('/tmp/dc_' + ++debCount + '.svg', dc)
  }
  getPerimeterPoly(perimeter: Set<CdtEdge>): Polyline {
    const adjSites = new Map<CdtSite, CdtEdge[]>() // actually, each value array whill have exactly two elements
    for (const e of perimeter) {
      adjSites.set(e.lowerSite, [])
      adjSites.set(e.upperSite, [])
    }
    for (const e of perimeter) {
      adjSites.get(e.lowerSite).push(e)
      adjSites.get(e.upperSite).push(e)
    }
    let e = perimeter.values().next().value
    const poly = Polyline.mkFromPoints([e.lowerSite.point, e.upperSite.point])
    const n = perimeter.size
    let lastSite = e.upperSite
    // we should create n-2 edge and then close the polyline
    for (let k = 1; k < n; k++) {
      const ens = adjSites.get(lastSite)
      const en = ens[0] === e ? ens[1] : ens[0]
      lastSite = en.upperSite === lastSite ? en.lowerSite : en.upperSite
      poly.addPoint(lastSite.point)
      e = en
    }
    poly.closed = true
    poly.RemoveCollinearVertices()
    return poly
  }

  private getPerimeterEdges(): Set<CdtEdge> {
    const perimeter = new Set<CdtEdge>()
    for (const t of this.triangles) {
      for (const e of t.TriEdges) {
        if (!this.triangles.has(e.GetOtherTriangle_T(t))) {
          perimeter.add(e)
        }
      }
    }
    return perimeter
  }

  findTrianglesIntersectingThePolyline_() {
    let p = this.poly.startPoint.next
    const psite = this.cdt.PointsToSites.get(p.point)
    let ft: CdtTriangle
    for (const t of psite.Triangles()) {
      ft = t
      break
    }
    const threader = new CdtThreader(ft, p.point, p.next.point)

    while (true) {
      this.sweepOnePolylineSegment(threader)
      p = p.next
      if (p == null) break
      if (p.next == null) break
      if (p.next.next == null) break
      threader.start = threader.end
      threader.end = this.shiftToToChannel(p.next)
    }
  }
  shiftToToChannel(pp: PolylinePoint): Point {
    const site = this.cdt.PointsToSites.get(pp.point)
    if (site == null) return pp.point
    const ppObstacle = this.cdt.PointsToSites.get(pp.point).Owner as Polyline
    const center = ppObstacle.boundingBox.center
    const cpp = pp.point.sub(center).normalize().mul(GeomConstants.intersectionEpsilon).add(pp.point)
    return cpp
  }

  sweepOnePolylineSegment(threader: CdtThreader) {
    do {
      this.triangles.add(threader.CurrentTriangle)
    } while (threader.MoveNext())
    this.triangles.add(threader.CurrentTriangle)
  }

  private addInnerTrianglesOfObstacle(psite: CdtSite) {
    const sourcePoly = psite.Owner as Polyline

    for (const p of sourcePoly) {
      const s = this.cdt.PointsToSites.get(p)
      for (const t of s.Triangles()) {
        if (triangIsInsideOfObstacle(t)) {
          this.triangles.add(t)
        }
      }
    }
  }
}

// function findStartTriangle(cdt: Cdt, p: PolylinePoint): CdtTriangle {
//   const pointMap = cdt.PointsToSites
//   let pSite = pointMap.get(p.point)
//   if (pSite == null) {
//     pSite = pointMap.get(p.next.point) // assume that the second point of the polyline to the loose polyline, and cdt is build on those
//     if (pSite == null) return null

//     // go back to the start point
//     let tri = pSite.InEdges[0].CcwTriangle // should contain pSite.point
//     if (CdtTriangle.PointLocationForTriangle(p.point, tri) != PointLocation.Outside) {
//       return tri
//     }
//     const threader = new CdtThreader(pSite.InEdges[0].CcwTriangle, pSite.point, p.point)

//     const debugTri = []
//     let piercedEdge: CdtEdge
//     while (threader.MoveNext()) {
//       tri = threader.CurrentTriangle
//       // piercedEdge = threader.CurrentPiercedEdge
//       debugTri.push(tri)
//       if (CdtTriangle.PointLocationForTriangle(p.point, tri) != PointLocation.Outside) return tri
//     }
//     // tri = piercedEdge.GetOtherTriangle_T(tri)

//     const dc = getDebugCurvesFromEdgesAndCdt(p.polyline, cdt)
//     const ftri = pSite.InEdges[0].CcwTriangle
//     for (const e of ftri.TriEdges) {
//       dc.push(DebugCurve.mkDebugCurveI(LineSegment.mkPP(e.lowerSite.point, e.upperSite.point)))
//     }
//     for (const dt of debugTri)
//       for (const e of dt.TriEdges) {
//         dc.push(DebugCurve.mkDebugCurveTWCI(200, 2, 'Yellow', LineSegment.mkPP(e.lowerSite.point, e.upperSite.point)))
//       }
//     SvgDebugWriter.dumpDebugCurves('/tmp/bad_poly.svg', dc)
//     Assert.assert(false)
//     return null
//   } else
//     // for (const tri of pSite.Triangles()) {
//     //   const dc = getDebugCurvesFromEdgesAndCdt(p.polyline, cdt)
//     //   for (const e of tri.TriEdges) {
//     //     dc.push(DebugCurve.mkDebugCurveI(LineSegment.mkPP(e.lowerSite.point, e.upperSite.point)))
//     //   }
//     //   SvgDebugWriter.dumpDebugCurves('/tmp/bad_poly.svg', dc)

//       return tri
//     }
// }

function getDebugCurvesFromEdgesAndCdt(c: Polyline, cdt: Cdt): DebugCurve[] {
  const ret = [DebugCurve.mkDebugCurveTWCI(200, 1, 'Red', c), DebugCurve.mkDebugCurveTWCI(200, 1, 'Red', CurveFactory.mkCircle(5, c.start))]
  for (const s of cdt.PointsToSites.values()) {
    for (const e of s.Edges) {
      const constr = e.constrained
      ret.push(
        DebugCurve.mkDebugCurveTWCI(
          100,
          constr ? 2 : 0.5,
          constr ? 'Blue' : 'Green',
          LineSegment.mkPP(e.lowerSite.point, e.upperSite.point),
        ),
      )
    }
  }

  return ret
}

function initInEdges(cdt: Cdt) {
  for (const site of cdt.PointsToSites.values()) {
    for (const e of site.Edges) {
      const oSite = e.lowerSite

      if (oSite.InEdges.length > 0) {
        return // in edges are set
      } else {
        break
      }
    }
    cdt.SetInEdges()
  }
}

function triangIsInsideOfObstacle(t: CdtTriangle): boolean {
  return t.Sites.item0.Owner != null && t.Sites.item0.Owner == t.Sites.item1.Owner && t.Sites.item0.Owner == t.Sites.item2.Owner
}

function triangleCircle(n: CdtTriangle, r: number): DebugCurve {
  const center = n.Sites.item0.point
    .add(n.Sites.item1.point)
    .add(n.Sites.item2.point)
    .mul(1 / 3)
  return DebugCurve.mkDebugCurveCI('Brown', CurveFactory.mkCircle(r, center))
}
