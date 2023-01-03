import {Queue} from 'queue-typescript'
import {SvgDebugWriter} from '../../../test/utils/svgDebugWriter'
import {CurveFactory, GeomConstants, LineSegment, Point, Polyline} from '../../math/geometry'
import {DebugCurve} from '../../math/geometry/debugCurve'
import {PolylinePoint} from '../../math/geometry/polylinePoint'
import {Assert} from '../../utils/assert'
import {Cdt} from '../ConstrainedDelaunayTriangulation/Cdt'
import {CdtEdge as E} from '../ConstrainedDelaunayTriangulation/CdtEdge'
import {CdtSite as S} from '../ConstrainedDelaunayTriangulation/CdtSite'
import {CdtTriangle as T} from '../ConstrainedDelaunayTriangulation/CdtTriangle'
/** Optimize path locally, without changing its topology.
 * The obstacles are represented by constrained edges of cdd, the Delaunay triangulation.
 * It is assumed that the polyline passes only through the sites of the cdt.
 */
let debCount = 0
type SleeveEdge = {source: T; edge: E} // the target of s would be otherTriange s.edge.getOtherTriangle_T(s.source)
export class PathOptimizer {
  cdt: Cdt
  poly: Polyline
  sourcePoly: Polyline
  targetPoly: Polyline
  constructor(cdt: Cdt) {
    this.cdt = cdt
    cdt.SetInEdges()
  }
  triangles = new Set<T>()
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
    const q = new Queue<T>()
    const t = site.Edges[0].CcwTriangle
    const trs = new Set<T>()
    q.enqueue(t)
    trs.add(t)
    while (q.length > 0) {
      const t = q.dequeue()
      this.addToTriangles(t)
      for (const e of t.Edges) {
        const ot = e.GetOtherTriangle_T(t)
        if (trs.has(ot)) continue
        if (ot.intersectsLine(site.point, end)) {
          q.enqueue(ot)
          trs.add(ot)
        }
      }
    }
  }
  private addToTriangles(t: T) {
    const owner = t.Sites.item0.Owner
    if (owner === this.sourcePoly || owner === this.targetPoly || !triangIsInsideOfObstacle(t)) {
      this.triangles.add(t)
    }
  }
  /** following "https://page.mi.fu-berlin.de/mulzer/notes/alggeo/polySP.pdf" */
  run(poly: Polyline): void {
    this.poly = poly
    if (this.poly.count <= 2) return
    Assert.assert(this.poly.count >= 4)
    this.findTrianglesIntersectingThePolyline()

    const perimeter = this.getPerimeterEdges()
    const perimeterPoly = this.getPerimeterPoly(perimeter)

    this.cdt = new Cdt([], [perimeterPoly], [])
    this.cdt.run()

    //looking for the sleeve
    let sourceTriangle: T
    for (const t of this.cdt.GetTriangles()) {
      if (t.containsPoint(this.poly.start)) {
        sourceTriangle = t
        break
      }
    }

    const sleeve: SleeveEdge[] = this.getSleeve(sourceTriangle)

    const dc = getDebugCurvesFromEdgesAndCdt(this.poly, this.cdt)
    for (let pp = perimeterPoly.startPoint; pp.next; pp = pp.next) {
      dc.push(DebugCurve.mkDebugCurveTWCI(200, 1, 'Black', LineSegment.mkPP(pp.point, pp.next.point)))
    }
    for (const e of sourceTriangle.Edges) {
      dc.push(DebugCurve.mkDebugCurveTWCI(200, 2, 'Purple', LineSegment.mkPP(e.lowerSite.point, e.upperSite.point)))
    }

    SvgDebugWriter.dumpDebugCurves('/tmp/dc_' + ++debCount + '.svg', dc)
  }
  getSleeve(sourceTriangle: T): SleeveEdge[] {
    const q = new Queue<T>()
    q.enqueue(sourceTriangle)

    const edgeMap = new Map<T, SleeveEdge | undefined>()
    edgeMap.set(sourceTriangle, undefined)
    while (q.length > 0) {
      const t = q.dequeue()
      const edgeIntoT = edgeMap.get(t)
      if (t.containsPoint(this.poly.end)) {
        return this.recoverPath(sourceTriangle, edgeMap, t)
      }
      for (const e of t.Edges) {
        if (e.constrained) continue // do not leave the polygon:
        // we walk a dual graph of a triangulation of a simple polygon: it is a tree!
        if (edgeIntoT !== undefined && e === edgeIntoT.edge) continue
        const ot = e.GetOtherTriangle_T(t)
        if (ot == null) continue
        Assert.assert(!edgeMap.has(ot))
        edgeMap.set(ot, {source: t, edge: e})
        q.enqueue(ot)
      }
    }
  }
  recoverPath(sourcTriangle: T, edgeMap: Map<T, SleeveEdge>, t: T): SleeveEdge[] {
    const ret = []
    for (let tr = t; tr != sourcTriangle; ) {
      if (tr === sourcTriangle) break
      const e = edgeMap.get(tr)
      ret.push(e)
      tr = e.source
    }
    return ret.reverse()
  }
  /** the main purpose of this method is to shorcut collinear vertices */
  getPerimeterPoly(perimeter: Set<E>): Polyline {
    const adjSites = new Map<S, E[]>() // actually, each value array whill have exactly two elements
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
    for (let k = 2; k < n; k++) {
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

  private getPerimeterEdges(): Set<E> {
    const perimeter = new Set<E>()
    for (const t of this.triangles) {
      for (const e of t.Edges) {
        if (!this.triangles.has(e.GetOtherTriangle_T(t))) {
          perimeter.add(e)
        }
      }
    }
    return perimeter
  }

  shiftToToChannel(pp: PolylinePoint): Point {
    const site = this.cdt.PointsToSites.get(pp.point)
    if (site == null) return pp.point
    const ppObstacle = this.cdt.PointsToSites.get(pp.point).Owner as Polyline
    const center = ppObstacle.boundingBox.center
    const cpp = pp.point.sub(center).normalize().mul(GeomConstants.intersectionEpsilon).add(pp.point)
    return cpp
  }

  private addInnerTrianglesOfObstacle(psite: S) {
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

function triangIsInsideOfObstacle(t: T): boolean {
  return t.Sites.item0.Owner != null && t.Sites.item0.Owner == t.Sites.item1.Owner && t.Sites.item0.Owner == t.Sites.item2.Owner
}
