import {Queue} from 'queue-typescript'
import {GeomConstants, LineSegment, Point, Polyline} from '../../math/geometry'
import {DebugCurve} from '../../math/geometry/debugCurve'
import {segmentsIntersect} from '../../math/geometry/lineSegment'
import {TriangleOrientation} from '../../math/geometry/point'
import {RectangleNode} from '../../math/geometry/RTree/rectangleNode'
import {Cdt} from '../ConstrainedDelaunayTriangulation/Cdt'
import {CdtEdge, CdtEdge as E} from '../ConstrainedDelaunayTriangulation/CdtEdge'
import {CdtSite} from '../ConstrainedDelaunayTriangulation/CdtSite'
import {CdtTriangle as T} from '../ConstrainedDelaunayTriangulation/CdtTriangle'
import {ThreeArray} from '../ConstrainedDelaunayTriangulation/ThreeArray'
/** Optimize path locally, without changing its topology.
 * The obstacles are represented by constrained edges of cdd, the Delaunay triangulation.
 * It is assumed that the polyline passes only through the sites of the cdt.
 */
// let debCount = 0
// let drawCount = 0
/** the target of s would be otherTriange s.edge.getOtherTriangle_T(s.source) */
type SleeveEdge = {source: T; edge: E}
/** nextR and nextL are defined only for an apex */
type PathPoint = {point: Point; prev?: PathPoint; next?: PathPoint}

type Diagonal = {left: Point; right: Point}
export class PathOptimizer {
  cdt: Cdt
  poly: Polyline
  sourcePoly: Polyline
  targetPoly: Polyline
  d: Diagonal[]
  cdtRTree: RectangleNode<T, Point>
  setCdt(cdt: Cdt) {
    this.cdt = cdt
  }

  triangles = new Set<T>()
  private findTrianglesIntersectingThePolyline(eps: number) {
    this.triangles.clear()
    const passedTriSet = this.initPassedTriangles()
    for (let p = this.poly.startPoint; p.next; p = p.next) {
      this.addLineSeg(passedTriSet, p.point, p.next.point, eps)
    }
  }
  private initPassedTriangles(): Set<T> {
    const ret = new Set<T>()
    const p = this.sourcePoly.start
    const ps = this.cdt.FindSite(p)
    for (const e of ps.Edges) {
      let ot = e.CcwTriangle
      if (triangleIsInsideOfObstacle(ot)) {
        ret.add(ot)
        return ret
      }
      ot = e.CwTriangle
      if (triangleIsInsideOfObstacle(ot)) {
        ret.add(ot)
        return ret
      }
    }
    for (const e of ps.InEdges) {
      let ot = e.CcwTriangle
      if (triangleIsInsideOfObstacle(ot)) {
        ret.add(ot)
        return ret
      }
      ot = e.CwTriangle
      if (triangleIsInsideOfObstacle(ot)) {
        ret.add(ot)
        return ret
      }
    }
  }
  private addLineSeg(passedTriSet: Set<T>, start: Point, end: Point, eps: number): Set<T> {
    //Assert.assert(startTri.containsPoint(start))

    const q = new Queue<T>()
    const trs = new Set<T>()

    const containingEnd = []

    for (const t of passedTriSet) {
      enqueueTriangle(t, () => true)
      if (t.containsPoint(end)) {
        containingEnd.push(t)
      }
    }

    passedTriSet.clear()
    for (const t of containingEnd) {
      passedTriSet.add(t)
    }

    let t: T
    while (q.length > 0) {
      t = q.dequeue()
      this.addToTriangles(t)
      if (t.containsPoint(end)) {
        passedTriSet.add(t)
        continue
      }
      const t_neighbors = []
      for (const e of t.Edges) {
        const ot = e.GetOtherTriangle_T(t)

        if (ot == null || trs.has(ot)) continue
        t_neighbors.push(ot)
      }
      if (t_neighbors.length == 1) {
        // if there is only on triangle to exit t, we have to take it
        enqueueTriangle(t_neighbors[0], () => true)
      } else {
        for (const ot of t_neighbors) {
          if (this.triangleIntersectSegmentOrIsInsideEndObstacles(ot, start, end, eps)) {
            enqueueTriangle(ot, (t) => this.canBelongToTriangles(t))
          }
        }
      }
    }
    return passedTriSet

    function enqueueTriangle(tr: T, test: (t: T) => boolean) {
      q.enqueue(tr)
      trs.add(tr)

      if (test(tr) && tr.containsPoint(end)) {
        passedTriSet.add(tr)
      }
    }
  }
  private triangleIntersectSegmentOrIsInsideEndObstacles(ot: T, start: Point, end: Point, eps: number) {
    if (this.insideSourceOrTargetPoly(ot)) return true
    const ta = this.padTriangle(ot, eps)
    return triIntersectsLine()

    function triIntersectsLine(): boolean {
      if (pointIsInsideOfTriangle(start)) return true
      if (pointIsInsideOfTriangle(end)) return true

      return startEndIntersectsTrianglSide()
    }
    function pointIsInsideOfTriangle(p: Point): boolean {
      for (let i = 0; i < 3; i++) {
        const area = Point.signedDoubledTriangleArea(p, ta.getItem(i), ta.getItem(i + 1))
        if (area < -GeomConstants.distanceEpsilon) {
          return false
        }
      }

      return true
    }
    function startEndIntersectsTrianglSide(): boolean {
      for (let i = 0; i < 3; i++) {
        if (segmentsIntersect(start, end, ta.getItem(i), ta.getItem(i + 1))) return true
      }
      return false
    }
  }

  padTriangle(t: T, eps: number): ThreeArray<Point> {
    const m = t.Sites.item0.point
      .add(t.Sites.item1.point)
      .add(t.Sites.item2.point)
      .mul(1 / 3)

    const ta = new ThreeArray<Point>()
    ta.setItem(0, padSite(t.Sites.item0))
    ta.setItem(1, padSite(t.Sites.item1))
    ta.setItem(2, padSite(t.Sites.item2))
    return ta

    function padSite(s: CdtSite): Point {
      const d = s.point.sub(m)
      const len = d.length
      return m.add(d.mul((len + eps) / len))
    }
  }

  insideSourceOrTargetPoly(t: T): boolean {
    const owner = t.Sites.item0.Owner
    if (owner === this.sourcePoly || owner === this.targetPoly) {
      if (owner === t.Sites.item1.Owner && owner === t.Sites.item2.Owner) return true
    }
    return false
  }
  private canBelongToTriangles(t: T): boolean {
    const owner = t.Sites.item0.Owner
    return owner === this.sourcePoly || owner === this.targetPoly || !triangleIsInsideOfObstacle(t)
  }
  private addToTriangles(t: T) {
    if (this.canBelongToTriangles(t)) {
      this.triangles.add(t)
    }
  }
  /** following "https://page.mi.fu-berlin.de/mulzer/notes/alggeo/polySP.pdf" */
  run(poly: Polyline, sourcePoly: Polyline, targetPoly: Polyline) {
    //++debCount
    this.poly = poly
    this.d = []
    if (poly.count <= 2 || this.cdt == null) return
    this.sourcePoly = sourcePoly
    this.targetPoly = targetPoly
    //if (debCount == 3692) this.drawInitialPolyDebuggg(Array.from(this.cdt.GetTriangles()), null, null, poly)
    this.findTrianglesIntersectingThePolyline(0.05)

    let perimeter = this.getPerimeterEdges()
    perimeter = this.fillTheCollapedSites(perimeter)

    //if (debCount == 3692) this.drawInitialPolyDebuggg(Array.from(this.triangles), perimeter, null, poly)
    const localCdt = new Cdt(
      [],
      [],
      Array.from(perimeter).map((e) => {
        return {A: e.lowerSite.point, B: e.upperSite.point}
      }),
    )
    localCdt.run()
    //if (debCount == 3692) this.drawInitialPolyDebuggg(Array.from(localCdt.GetTriangles()), perimeter, null, poly)

    const sleeve: SleeveEdge[] = this.getSleeve(this.findSourceTriangle(localCdt))
    if (sleeve == null) {
      // this.poly remains unchanged in this case
      // in one case the original polyline was crossing a wrong obstacle and it caused the peremiter polyline
      // not having the end inside
      console.log('failed to create sleeve')
      return
    }
    this.initDiagonals(sleeve)

    //const dc = getDebugCurvesFromCdt(localCdt)
    this.refineFunnel() //dc)
    //  const c = this.poly
    // dc = dc.concat([
    //   DebugCurve.mkDebugCurveTWCI(200, 1, 'Red', c),
    //   DebugCurve.mkDebugCurveTWCI(200, 1, 'Red', CurveFactory.mkCircle(5, c.start)),
    // ])

    // for (let pp = perimeterPoly.startPoint; pp.next; pp = pp.next) {
    //   dc.push(DebugCurve.mkDebugCurveTWCI(200, 1, 'Black', LineSegment.mkPP(pp.point, pp.next.point)))
    // }

    // SvgDebugWriter.dumpDebugCurves('/tmp/dc_' + ++debCount + '.svg', dc)
  }
  /** Because of the floating point operations we might miss some triangles and get a polygon collapsing to a point somewhere inside of the polyline.
   * This point will correspond to a site adjacent to more than two edges from 'perimeter'.
   * We add to the polygon all the 'legal' triangles adjacent to this cite.
   */
  fillTheCollapedSites(perimeter: Set<E>): Set<E> {
    const siteToEdges = new Map<CdtSite, E[]>()
    for (const e of perimeter) {
      addEdgeToMap(e.lowerSite, e)
      addEdgeToMap(e.upperSite, e)
    }

    const sitesToFix = []
    for (const [site, es] of siteToEdges) {
      if (es.length > 2) {
        sitesToFix.push(site)
      }
    }
    if (sitesToFix.length == 0) return perimeter
    for (const s of sitesToFix) {
      for (const t of s.Triangles()) {
        if (this.canBelongToTriangles(t)) {
          this.triangles.add(t)
        }
      }
    }
    return this.getPerimeterEdges()

    function addEdgeToMap(site: CdtSite, e: CdtEdge) {
      let es = siteToEdges.get(site)
      if (es == null) {
        siteToEdges.set(site, (es = []))
      }
      es.push(e)
    }
  }
  private findSourceTriangle(localCdt: Cdt) {
    let sourceTriangle: T
    for (const t of localCdt.GetTriangles()) {
      if (t.containsPoint(this.poly.start)) {
        sourceTriangle = t
        break
      }
    }
    return sourceTriangle
  }

  // drawInitialPolyDebuggg(triangles: T[], perimEdges: Set<E>, perimeterPoly: Polyline, originalPoly: Polyline) {
  //   const dc = []
  //   for (const t of triangles) {
  //     for (const e of t.Edges) {
  //       dc.push(DebugCurve.mkDebugCurveTWCI(100, e.constrained ? 2 : 1, 'Cyan', LineSegment.mkPP(e.upperSite.point, e.lowerSite.point)))
  //     }
  //   }
  //   if (perimEdges) {
  //     for (const e of perimEdges) {
  //       dc.push(DebugCurve.mkDebugCurveTWCI(200, 3, 'Blue', LineSegment.mkPP(e.lowerSite.point, e.upperSite.point)))
  //     }
  //   }
  //   if (perimeterPoly) dc.push(DebugCurve.mkDebugCurveTWCI(200, 1, 'Red', perimeterPoly))
  //   if (originalPoly) dc.push(DebugCurve.mkDebugCurveTWCI(200, 1, 'Brown', originalPoly))
  //   dc.push(DebugCurve.mkDebugCurveTWCI(220, 8, 'Violet', this.sourcePoly))
  //   dc.push(DebugCurve.mkDebugCurveTWCI(220, 3, 'Magenta', this.targetPoly))

  //   SvgDebugWriter.dumpDebugCurves('./tmp/poly' + ++drawCount + '.svg', dc)
  // }

  private refineFunnel(/*dc: Array<DebugCurve>*/) {
    // remove param later:Debug
    const prefix: Point[] = [] // the path befor apex
    let v = this.poly.start // the apex point
    const leftChainStart: PathPoint = {point: v}
    const rightChainStart: PathPoint = {point: v}
    let leftChainEnd: PathPoint = {point: this.d[0].left, prev: leftChainStart}
    let rightChainEnd: PathPoint = {point: this.d[0].right, prev: rightChainStart}
    leftChainStart.next = leftChainEnd
    rightChainStart.next = rightChainEnd

    let z: Point
    for (let i = 1; i < this.d.length; i++) {
      processDiagonal(i, this.d)
    }
    // the shortest path will be on the right chain
    this.d.push({right: this.poly.end, left: leftChainEnd.point})
    processDiagonal(this.d.length - 1, this.d)
    const newPoly = Polyline.mkFromPoints(prefix)
    for (let p = rightChainStart; p != null; p = p.next) {
      newPoly.addPoint(p.point)
    }
    this.poly = newPoly

    function processDiagonal(i: number, d: Diagonal[]) {
      const leftStep = d[i - 1].left !== d[i].left

      // Assert.assert(!leftStep || d[i - 1].left.equal(d[i].left) == false)
      // Assert.assert(leftStep || d[i - 1].right !== d[i].right)
      if (leftStep) {
        z = d[i].left
        //draw(d[i - 1], d[i], dc)
        let p = leftChainEnd
        for (; !(isApex(p) || reflexLeft(p)); p = p.prev) {
          // just stepping back on the left chain
        }
        if (isApex(p)) {
          walkForwardOnTheRigthUntilSeeZ()
        } else {
          extendLeftChainFromP(p)
        }
      } else {
        // right step: the diagonal advanced on the right chain
        z = d[i].right
        let p = rightChainEnd
        for (; !(isApex(p) || reflexRight(p)); p = p.prev) {
          // just stepping back on the right chain
        }
        if (isApex(p)) {
          walkForwardOnTheLeftUntilSeeZ()
        } else {
          extendRightChainFromP(p)
        }
      }
      //draw(d[i - 1], d[i], dc)
    }

    // function draw(d: Diagonal, dn: Diagonal, dc: DebugCurve[]) {
    //   if (debCount < 1000000) return
    //   const ldc = dc.map((d) => d.clone())

    //   ldc.push(DebugCurve.mkDebugCurveTWCI(100, 3, 'Yellow', LineSegment.mkPP(d.left, d.right)))
    //   ldc.push(DebugCurve.mkDebugCurveTWCI(100, 3, 'cyan', LineSegment.mkPP(dn.left, dn.right)))
    //   for (let l: PathPoint = leftChainStart; l && l.next; l = l.next) {
    //     ldc.push(DebugCurve.mkDebugCurveTWCI(100, 3, 'Magenta', LineSegment.mkPP(l.point, l.next.point)))
    //   }
    //   for (let r: PathPoint = rightChainStart; r && r.next; r = r.next) {
    //     ldc.push(DebugCurve.mkDebugCurveTWCI(100, 3, 'Navy', LineSegment.mkPP(r.point, r.next.point)))
    //   }

    //   ldc.push(DebugCurve.mkDebugCurveTWCI(100, 3, 'red', CurveFactory.mkCircle(3, v)))

    //   if (prefix.length) {
    //     for (let i = 0; i < prefix.length - 1; i++) {
    //       ldc.push(DebugCurve.mkDebugCurveTWCI(200, 3, 'Black', LineSegment.mkPP(prefix[i], prefix[i + 1])))
    //     }
    //     ldc.push(DebugCurve.mkDebugCurveTWCI(200, 3, 'Black', LineSegment.mkPP(prefix[prefix.length - 1], v)))
    //   }

    //   //SvgDebugWriter.dumpDebugCurves('/tmp/dc_' + ++debCount + '.svg', ldc)
    // }
    function visibleRight(pp: PathPoint) {
      if (pp.next == null) {
        return true
      }
      return Point.pointToTheLeftOfLineOrOnLine(z, pp.point, pp.next.point)
    }
    function visibleLeft(pp: PathPoint) {
      if (pp.next == null) {
        return true
      }
      return Point.pointToTheRightOfLineOrOnLine(z, pp.point, pp.next.point)
    }
    function reflexLeft(pp: PathPoint): boolean {
      return Point.pointToTheLeftOfLine(z, pp.prev.point, pp.point)
    }
    function reflexRight(pp: PathPoint): boolean {
      return Point.pointToTheRightOfLine(z, pp.prev.point, pp.point)
    }
    function walkForwardOnTheRigthUntilSeeZ() {
      let p = rightChainStart
      while (!visibleRight(p)) {
        p = p.next
      }
      if (!isApex(p)) {
        // got the new apex in p
        let r = rightChainStart
        for (; !r.point.equal(p.point); r = r.next) {
          prefix.push(r.point)
        }
        rightChainStart.point = r.point
        rightChainStart.next = r.next // need to keep rightChainStart and rightChainEnd different while r might be rightChainEnd here
        v = r.point
        if (rightChainEnd.point.equal(rightChainStart.point)) {
          rightChainEnd.prev = rightChainEnd.next = null
        }
      }
      leftChainStart.point = v
      leftChainEnd.point = z
      leftChainEnd.prev = leftChainStart
      leftChainStart.next = leftChainEnd
    }
    function walkForwardOnTheLeftUntilSeeZ() {
      let p = leftChainStart
      while (!visibleLeft(p)) {
        p = p.next
      }
      if (!isApex(p)) {
        // got the new apex at p
        let r = leftChainStart
        for (; !r.point.equal(p.point); r = r.next) {
          prefix.push(r.point)
        }
        leftChainStart.point = r.point //  need to keep leftChainStart and leftChainEnd different while r might be leftChainEnd here
        leftChainStart.next = r.next
        v = r.point
        if (leftChainEnd.point.equal(leftChainStart.point)) {
          leftChainEnd.prev = leftChainStart.next = null
        }
      }
      rightChainStart.point = v
      rightChainEnd.point = z
      rightChainEnd.prev = rightChainStart
      rightChainStart.next = rightChainEnd
    }
    function isApex(pp: PathPoint) {
      const ret = pp.point == v
      //Assert.assert(ret || !pp.point.equal(v))
      return ret
    }

    function extendRightChainFromP(p: PathPoint) {
      if (p != rightChainEnd) {
        rightChainEnd.point = z
        rightChainEnd.prev = p
        p.next = rightChainEnd
      } else {
        rightChainEnd = {point: z, prev: p}
        p.next = rightChainEnd
      }
    }

    function extendLeftChainFromP(p: PathPoint) {
      if (p != leftChainEnd) {
        leftChainEnd.point = z
        leftChainEnd.prev = p
        p.next = leftChainEnd
      } else {
        leftChainEnd = {point: z, prev: p}
        p.next = leftChainEnd
      }
    }
  }

  private initDiagonals(sleeve: SleeveEdge[]) {
    for (const sleeveEdge of sleeve) {
      const e = sleeveEdge.edge
      const site = sleeveEdge.source.OppositeSite(e)
      if (Point.getTriangleOrientation(site.point, e.lowerSite.point, e.upperSite.point) == TriangleOrientation.Counterclockwise) {
        this.d.push({left: e.upperSite.point, right: e.lowerSite.point})
      } else {
        this.d.push({right: e.upperSite.point, left: e.lowerSite.point})
      }
    }
  }
  private getSleeve(sourceTriangle: T): SleeveEdge[] {
    const q = new Queue<T>()
    //Assert.assert(sourceTriangle != null)
    q.enqueue(sourceTriangle)
    // Assert.assert(sourceTriangle != null)
    const edgeMap = new Map<T, E>()
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
        if (edgeIntoT !== undefined && e === edgeIntoT) continue
        const ot = e.GetOtherTriangle_T(t)
        if (ot == null) continue
        if (edgeMap.has(ot)) continue

        edgeMap.set(ot, e)
        q.enqueue(ot)
      }
    }
  }
  private recoverPath(sourceTriangle: T, edgeMap: Map<T, E>, t: T): SleeveEdge[] {
    const ret = []
    for (let tr = t; tr != sourceTriangle; ) {
      if (tr === sourceTriangle) break
      const e = edgeMap.get(tr)
      tr = e.GetOtherTriangle_T(tr)
      ret.push({source: tr, edge: e})
    }
    return ret.reverse()
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
}

function triangleIsInsideOfObstacle(t: T): boolean {
  return t.Sites.item0.Owner != null && t.Sites.item0.Owner == t.Sites.item1.Owner && t.Sites.item0.Owner == t.Sites.item2.Owner
}
function getDebugCurvesFromCdt(localCdt: Cdt): Array<DebugCurve> {
  const es = new Set<E>()
  for (const t of localCdt.GetTriangles()) {
    for (const e of t.Edges) es.add(e)
  }
  return Array.from(es).map((e) => DebugCurve.mkDebugCurveTWCI(100, 1, 'Navy', LineSegment.mkPP(e.lowerSite.point, e.upperSite.point)))
}
