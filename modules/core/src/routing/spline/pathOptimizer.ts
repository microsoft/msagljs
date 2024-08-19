import {Queue} from 'queue-typescript'
import {ICurve, LineSegment, Point, Polyline} from '../../math/geometry'
import {TriangleOrientation} from '../../math/geometry/point'
import {Cdt} from '../ConstrainedDelaunayTriangulation/Cdt'
import {CdtEdge, CdtEdge as Ed} from '../ConstrainedDelaunayTriangulation/CdtEdge'
import {CdtSite} from '../ConstrainedDelaunayTriangulation/CdtSite'
import {CdtTriangle as Tr} from '../ConstrainedDelaunayTriangulation/CdtTriangle'
// import {DebugCurve, writeDebugCurves} from '../../math/geometry/debugCurve'
/** Optimize path locally, without changing its topology.
 * The obstacles are represented by constrained edges of cdd, the Delaunay triangulation.
 * It is not assumed that the polyline passes only through the sites of the cdt.
//  */
// let debCount = 0
// let drawCount = 0
/** the target of s would be otherTriange:  s.edge.getOtherTriangle_T(s.source) */
type FrontEdge = {source: Tr; edge: Ed; leftSign?: number; rightSign?: number}
/** nextR and nextL are defined only for an apex */
type PathPoint = {point: Point; prev?: PathPoint; next?: PathPoint}

type Diagonal = {left: Point; right: Point}
export class PathOptimizer {
  private cdt: Cdt
  poly: Polyline
  private sourcePoly: Polyline
  private targetPoly: Polyline
  private d: Diagonal[]
  setCdt(cdt: Cdt) {
    this.cdt = cdt
    this.cdt.SetInEdges()
    const polys = new Set<Polyline>()
    for (const t of cdt.GetTriangles()) {
      for (const s of t.Sites) {
        if (s.Owner != null) polys.add(s.Owner as Polyline)
      }
    }
  }

  triangles = new Set<Tr>()

  private outsideOfObstacles(t: Tr): boolean {
    if (t == null) return false
    const owner = t.Sites.item0.Owner ?? t.Sites.item1.Owner
    return owner === this.sourcePoly || owner === this.targetPoly || !triangleIsInsideOfObstacle(t)
  }

  /** following "https://page.mi.fu-berlin.de/mulzer/notes/alggeo/polySP.pdf" */
  run(poly: Polyline) {
    // console.log('debCount=', ++debCount)
    this.triangles.clear()

    this.poly = poly
    this.d = []
    if (poly.count <= 2 || this.cdt == null) return
    this.sourcePoly = this.findPoly(poly.start)
    this.targetPoly = this.findPoly(poly.end)
    // if (debCount == 132) {
    //   this.debugDraw(Array.from(this.cdt.GetTriangles()), null, null, poly)
    // }
    this.findChannelTriangles()
    // if (debCount == 132) this.debugDraw(Array.from(this.triangles), null, null, poly)

    let perimeter = this.getPerimeterEdges()
    perimeter = this.fillTheCollapedSites(perimeter)
    // if (debCount == 132) {
    //   this.debugDraw(Array.from(this.cdt.GetTriangles()), perimeter, null, this.poly)
    // }
    const localCdt = new Cdt(
      [],
      [],
      Array.from(perimeter).map((e) => {
        return {A: e.lowerSite.point, B: e.upperSite.point}
      }),
    )
    localCdt.run()
    // if (debCount == 132) {
    //   this.debugDraw(Array.from(localCdt.GetTriangles()), null, null, poly)
    // }

    const sleeve: FrontEdge[] = this.getSleeve(this.findSourceTriangle(localCdt))
    if (sleeve == null) {
      // this.poly remains unchanged in this case
      // in one case the original polyline was crossing a wrong obstacle and it caused the peremiter polyline
      // not having the end inside
      console.log('failed to create sleeve')
      return
    }
    if (sleeve.length == 0) {
      this.poly = Polyline.mkFromPoints([poly.start, poly.end])
      return
    }
    this.initDiagonals(sleeve)
    this.refineFunnel()
    // this.debugDraw(Array.from(localCdt.GetTriangles()), null, null, poly)
  }
  /**A function that returns an array of all crossed triangles
   * by a line segment from start to end
   * assuming the initial triangle contains the start point*/
  private getAllCrossedTriangles(t: Tr, start: Point, end: Point): {triangles: Tr[]; containsEnd: Tr} {
    // Initialize an empty array to store the crossed triangles
    const crossed: Tr[] = []
    // Initialize a queue to store the triangles to visit
    const queue: Tr[] = []
    let containsEnd: Tr | null = null
    // Add the initial triangle to the queue
    queue.push(t)
    // Loop until the queue is empty
    while (queue.length > 0) {
      // Dequeue a triangle from the queue
      const current = queue.pop()!
      if (containsEnd == null && current.containsPoint(end)) {
        containsEnd = current
      }
      // Check if the triangle intersects the line segment
      if (current.intersectsLine(start, end, 0)) {
        // Add the triangle to the crossed array
        crossed.push(current)
        // Loop through the neighbors of the triangle
        for (const e of current.Edges) {
          // Check if the neighbor exists and is not already in the crossed array or the queue
          const tr = e.GetOtherTriangle_T(current)
          if (tr && !crossed.includes(tr) && !queue.includes(tr)) {
            // Add the neighbor to the queue
            queue.push(tr)
          }
        }
      }
    }
    // Return the crossed array
    return {triangles: crossed, containsEnd: containsEnd!}
  }

  findChannelTriangles() {
    const site = this.cdt.FindSite(this.poly.start)
    let t = site.Triangles().next().value

    this.triangles.clear()
    for (let p = this.poly.startPoint; p.next != null; p = p.next) {
      const res = this.getAllCrossedTriangles(t, p.point, p.next.point)
      t = res.containsEnd
      for (const tr of res.triangles) {
        if (this.outsideOfObstacles(tr)) this.triangles.add(tr)
      }
    }
  }
  findPoly(p: Point): Polyline {
    const site = this.cdt.FindSite(p)
    for (const edge of site.Edges) {
      const poly = edge.lowerSite.Owner ?? edge.upperSite.Owner
      return poly
    }
  }
  /** Because of the floating point operations we might miss some triangles and get a polygon collapsing to a point somewhere inside of the polyline.
   * This point will correspond to a site adjacent to more than two edges from 'perimeter'.
   * We add to the polygon all the 'legal' triangles adjacent to this cite.
   */
  fillTheCollapedSites(perimeter: Set<Ed>): Set<Ed> {
    const siteToEdges = new Map<CdtSite, Ed[]>()
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
        if (this.outsideOfObstacles(t)) {
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
    let sourceTriangle: Tr
    for (const t of localCdt.GetTriangles()) {
      if (t.containsPoint(this.poly.start)) {
        sourceTriangle = t
        break
      }
    }
    return sourceTriangle
  }

  // debugDraw(triangles: Tr[], perimEdges: Set<Ed>, poly: Polyline, originalPoly: Polyline, strangeObs: ICurve[] = [], ls: ICurve = null) {
  //   const dc = []
  //   if (ls) {
  //     dc.push(DebugCurve.mkDebugCurveTWCI(255, 5, 'PapayaWhip', ls))
  //   }
  //   const box = this.poly.boundingBox.clone()
  //   box.addRec(this.sourcePoly.boundingBox)
  //   box.addRec(this.targetPoly.boundingBox)
  //   for (const t of triangles) {
  //     // if (t.BoundingBox().intersects(box) == false) continue
  //     for (const e of t.Edges) {
  //       dc.push(
  //         DebugCurve.mkDebugCurveTWCI(
  //           e.constrained ? 150 : 100,
  //           e.constrained ? 1.5 : 1,
  //           e.constrained ? 'DarkSeaGreen' : 'Cyan',
  //           LineSegment.mkPP(e.upperSite.point, e.lowerSite.point),
  //         ),
  //       )
  //     }
  //   }
  //   if (perimEdges) {
  //     for (const e of perimEdges) {
  //       dc.push(DebugCurve.mkDebugCurveTWCI(200, 2.5, 'Blue', LineSegment.mkPP(e.lowerSite.point, e.upperSite.point)))
  //     }
  //   }
  //   if (poly) dc.push(DebugCurve.mkDebugCurveTWCI(200, 1, 'Green', poly))
  //   for (const strangeOb of strangeObs) {
  //     dc.push(DebugCurve.mkDebugCurveTWCI(200, 3, 'Pink', strangeOb))
  //   }

  //   if (originalPoly) dc.push(DebugCurve.mkDebugCurveTWCI(200, 1, 'Brown', originalPoly))
  //   dc.push(DebugCurve.mkDebugCurveTWCI(200, 0.5, 'Violet', this.sourcePoly))
  //   dc.push(DebugCurve.mkDebugCurveTWCI(200, 0.5, 'Magenta', this.targetPoly))

  //   writeDebugCurves('./tmp/poly' + ++drawCount + '.svg', dc)
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

  private initDiagonals(sleeve: FrontEdge[]) {
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
  private getSleeve(sourceTriangle: Tr): FrontEdge[] {
    const q = new Queue<Tr>()
    //Assert.assert(sourceTriangle != null)
    q.enqueue(sourceTriangle)
    // Assert.assert(sourceTriangle != null)
    const edgeMap = new Map<Tr, Ed>()
    edgeMap.set(sourceTriangle, undefined)
    while (q.length > 0) {
      const t = q.dequeue()
      const edgeIntoT = edgeMap.get(t)
      if (t.containsPoint(this.poly.end)) {
        return this.recoverPath(sourceTriangle, edgeMap, t)
      }
      for (const e of t.Edges) {
        if (e.constrained) continue // do not leave the polygon:
        // we walk a dual graph of a triangulation of a polygon:
        // it is not always a simple polygon, but usually it is
        if (edgeIntoT !== undefined && e === edgeIntoT) continue
        const ot = e.GetOtherTriangle_T(t)
        if (ot == null) continue
        if (edgeMap.has(ot)) continue

        edgeMap.set(ot, e)
        q.enqueue(ot)
      }
    }
  }
  private recoverPath(sourceTriangle: Tr, edgeMap: Map<Tr, Ed>, t: Tr): FrontEdge[] {
    const ret = []
    for (let tr = t; tr != sourceTriangle; ) {
      if (tr === sourceTriangle) break
      const e = edgeMap.get(tr)
      tr = e.GetOtherTriangle_T(tr)
      ret.push({source: tr, edge: e})
    }
    return ret.reverse()
  }

  private getPerimeterEdges(): Set<Ed> {
    const perimeter = new Set<Ed>()
    for (const t of this.triangles) {
      for (const e of t.Edges) {
        if (!this.triangles.has(e.GetOtherTriangle_T(t))) {
          perimeter.add(e)
        }
      }
    }
    return perimeter
  }
  // threader region
}

function triangleIsInsideOfObstacle(t: Tr): boolean {
  if (t.Sites.item0.Owner == null || t.Sites.item1.Owner == null || t.Sites.item2.Owner == null) {
    return true // one of the sites corresponds to a Port
  }
  return t.Sites.item0.Owner == t.Sites.item1.Owner && t.Sites.item0.Owner == t.Sites.item2.Owner
}
