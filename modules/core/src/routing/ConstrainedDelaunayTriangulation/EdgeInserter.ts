import {Point} from '../../math/geometry'
import {RBNode} from '../../math/RBTree/rbNode'
import {RBTree} from '../../math/RBTree/rbTree'
import {RealNumberSpan} from '../../utils/RealNumberSpan'
import {CdtEdge} from './CdtEdge'
import {CdtFrontElement} from './CdtFrontElement'
import {CdtSite} from './CdtSite'
import {CdtSweeper, InCircle} from './CdtSweeper'
import {CdtTriangle} from './CdtTriangle'

export class EdgeInserter {
  traversingEdge: CdtEdge

  triangles: Set<CdtTriangle>

  front: RBTree<CdtFrontElement>

  createEdgeDelegate: (a: CdtSite, b: CdtSite) => CdtEdge

  rightPolygon: Array<CdtSite> = new Array<CdtSite>()

  leftPolygon: Array<CdtSite> = new Array<CdtSite>()

  addedTriangles: Array<CdtTriangle> = new Array<CdtTriangle>()

  public constructor(
    traversingEdge: CdtEdge,
    triangles: Set<CdtTriangle>,
    front: RBTree<CdtFrontElement>,
    createEdgeDelegate: (a: CdtSite, b: CdtSite) => CdtEdge,
  ) {
    this.traversingEdge = traversingEdge
    this.triangles = triangles
    this.front = front
    this.createEdgeDelegate = createEdgeDelegate
  }

  public runEdgeInserter() {
    this.TraceEdgeThroughTriangles()
    this.TriangulatePolygon0(this.rightPolygon, this.traversingEdge.upperSite, this.traversingEdge.lowerSite, true)
    this.TriangulatePolygon0(this.leftPolygon, this.traversingEdge.upperSite, this.traversingEdge.lowerSite, false)
    this.UpdateFront()
  }

  UpdateFront() {
    const newFrontEdges = new Set<CdtEdge>()
    for (const t of this.addedTriangles) {
      for (const e of t.Edges)
        if (e.CwTriangle == null || e.CcwTriangle == null) {
          // @ts-ignore
          if (e.lowerSite == this._sweeper.p_2 && e.upperSite == this._sweeper.p_1) {
            continue
          }

          newFrontEdges.add(e)
        }
    }
    for (const e of newFrontEdges) this.AddEdgeToFront(e)
  }

  AddEdgeToFront(e: CdtEdge) {
    const leftSite = e.upperSite.point.x < e.lowerSite.point.x ? e.upperSite : e.lowerSite
    this.front.insert(new CdtFrontElement(leftSite, e))
  }

  TriangulatePolygon0(polygon: Array<CdtSite>, a: CdtSite, b: CdtSite, reverseTrangleWhenCompare: boolean) {
    if (polygon.length > 0) {
      this.TriangulatePolygon1(0, polygon.length - 1, polygon, a, b, reverseTrangleWhenCompare)
    }
  }

  TriangulatePolygon1(start: number, end: number, polygon: Array<CdtSite>, a: CdtSite, b: CdtSite, reverseTrangleWhenCompare: boolean) {
    //            if(CdtSweeper.db)
    //               CdtSweeper.ShowFront(triangles,front, Enumerable.Range(start, end-start+1).Select(i=> new Ellipse(10,10,polygon[i].point)).ToArray(), new[]{new LineSegment(a.point,b.point)});
    let c = polygon[start]
    let cIndex: number = start
    for (let i: number = start + 1; i <= end; i++) {
      const v = polygon[i]
      if (EdgeInserter.LocalInCircle(v, a, b, c, reverseTrangleWhenCompare)) {
        cIndex = i
        c = v
      }
    }

    const t = CdtTriangle.mkSSSD(a, b, c, this.createEdgeDelegate)
    this.triangles.add(t)
    this.addedTriangles.push(t)
    if (start < cIndex) {
      this.TriangulatePolygon1(start, cIndex - 1, polygon, a, c, reverseTrangleWhenCompare)
    }

    if (cIndex < end) {
      this.TriangulatePolygon1(cIndex + 1, end, polygon, c, b, reverseTrangleWhenCompare)
    }
  }

  static LocalInCircle(v: CdtSite, a: CdtSite, b: CdtSite, c: CdtSite, reverseTrangleWhenCompare: boolean): boolean {
    return reverseTrangleWhenCompare ? InCircle(v, a, c, b) : InCircle(v, a, b, c)
  }

  TraceEdgeThroughTriangles() {
    this.initEdgeTracer()
    this.runEdgeTracel()
  }
  /** edge tracer region */

  // the upper site of the traversing edge
  a: CdtSite
  // the lower site of the traversing edge
  b: CdtSite
  piercedEdge: CdtEdge
  piercedTriangle: CdtTriangle
  piercedToTheLeftFrontElemNode: RBNode<CdtFrontElement>
  piercedToTheRightFrontElemNode: RBNode<CdtFrontElement>
  elementsToBeRemovedFromFront = new Array<CdtFrontElement>()
  removedTriangles: Array<CdtTriangle>

  runEdgeTracel() {
    this.initEdgeTracer()
    this.Traverse()
  }

  Traverse() {
    while (!this.BIsReached()) {
      if (this.piercedToTheLeftFrontElemNode != null) {
        this.ProcessLeftFrontPiercedElement()
      } else if (this.piercedToTheRightFrontElemNode != null) {
        this.ProcessRightFrontPiercedElement()
      } else {
        this.ProcessPiercedEdge()
      }
    }

    if (this.piercedTriangle != null) {
      this.removePiercedTriangle(this.piercedTriangle)
    }

    this.FindMoreRemovedFromFrontElements()
    for (const elem of this.elementsToBeRemovedFromFront) {
      this.front.remove(elem)
    }
  }

  ProcessLeftFrontPiercedElement() {
    // CdtSweeper.ShowFront(triangles, front,new []{new LineSegment(a.point, b.point),new LineSegment(piercedToTheLeftFrontElemNode.item.Edge.lowerSite.point,piercedToTheLeftFrontElemNode.item.Edge.upperSite.point)},null);
    let v = this.piercedToTheLeftFrontElemNode
    do {
      this.elementsToBeRemovedFromFront.push(v.item)
      this.AddSiteToLeftPolygon(v.item.LeftSite)
      v = this.front.previous(v)
    } while (Point.pointToTheLeftOfLine(v.item.LeftSite.point, this.a.point, this.b.point)) //that is why we are adding to the left polygon

    this.elementsToBeRemovedFromFront.push(v.item)
    this.AddSiteToRightPolygon(v.item.LeftSite)
    if (v.item.LeftSite === this.b) {
      this.piercedToTheLeftFrontElemNode = v
      // this will stop the traversal
      return
    }

    this.FindPiercedTriangle(v)
    this.piercedToTheLeftFrontElemNode = null
  }

  FindPiercedTriangle(v: RBNode<CdtFrontElement>) {
    const e = v.item.Edge
    const t = e.CcwTriangle ?? e.CwTriangle
    const eIndex = t.Edges.index(e)
    for (let i = 1; i <= 2; i++) {
      const ei = t.Edges.getItem(i + eIndex)
      const signedArea0 = RealNumberSpan.sign(Point.signedDoubledTriangleArea(ei.lowerSite.point, this.a.point, this.b.point))
      const signedArea1 = RealNumberSpan.sign(Point.signedDoubledTriangleArea(ei.upperSite.point, this.a.point, this.b.point))
      if (signedArea1 * signedArea0 <= 0) {
        this.piercedTriangle = t
        this.piercedEdge = ei
        break
      }
    }
  }

  FindMoreRemovedFromFrontElements() {
    for (const triangle of this.removedTriangles) {
      for (const e of triangle.Edges) {
        if (e.CcwTriangle == null && e.CwTriangle == null) {
          const site = e.upperSite.point.x < e.lowerSite.point.x ? e.upperSite : e.lowerSite
          const frontNode = CdtSweeper.FindNodeInFrontBySite(this.front, site)
          if (frontNode.item.Edge === e) {
            this.elementsToBeRemovedFromFront.push(frontNode.item)
          }
        }
      }
    }
  }
  ProcessPiercedEdge() {
    // if(CdtSweeper.db)
    //          CdtSweeper.ShowFront(triangles, front, new[] { new LineSegment(a.point, b.point) },
    //                      new[] { new LineSegment(piercedEdge.upperSite.point, piercedEdge.lowerSite.point) });
    if (this.piercedEdge.CcwTriangle === this.piercedTriangle) {
      this.AddSiteToLeftPolygon(this.piercedEdge.lowerSite)
      this.AddSiteToRightPolygon(this.piercedEdge.upperSite)
    } else {
      this.AddSiteToLeftPolygon(this.piercedEdge.upperSite)
      this.AddSiteToRightPolygon(this.piercedEdge.lowerSite)
    }

    this.removePiercedTriangle(this.piercedTriangle)
    this.PrepareNextStateAfterPiercedEdge()
  }

  PrepareNextStateAfterPiercedEdge() {
    const t = this.piercedEdge.CwTriangle ?? this.piercedEdge.CcwTriangle
    const eIndex = t.Edges.index(this.piercedEdge)
    for (let i = 1; i <= 2; i++) {
      const e = t.Edges.getItem(i + eIndex)
      const signedArea0 = RealNumberSpan.sign(Point.signedDoubledTriangleArea(e.lowerSite.point, this.a.point, this.b.point))
      const signedArea1 = RealNumberSpan.sign(Point.signedDoubledTriangleArea(e.upperSite.point, this.a.point, this.b.point))
      if (signedArea1 * signedArea0 <= 0) {
        if (e.CwTriangle != null && e.CcwTriangle != null) {
          this.piercedTriangle = t
          this.piercedEdge = e
          break
        }

        // e has to belong to the front, and its triangle has to be removed
        this.piercedTriangle = null
        this.piercedEdge = null
        const leftSite = e.upperSite.point.x < e.lowerSite.point.x ? e.upperSite : e.lowerSite
        const frontElem = CdtSweeper.FindNodeInFrontBySite(this.front, leftSite)
        /*Assert.assert(frontElem != null)*/
        if (leftSite.point.x < this.a.point.x) {
          this.piercedToTheLeftFrontElemNode = frontElem
        } else {
          this.piercedToTheRightFrontElemNode = frontElem
        }

        this.removePiercedTriangle(e.CwTriangle ?? e.CcwTriangle)
        break
      }
    }
  }

  removePiercedTriangle(t: CdtTriangle) {
    this.triangles.delete(t)
    for (const e of t.Edges) {
      if (e.CwTriangle === t) {
        e.CwTriangle = null
      } else {
        e.CcwTriangle = null
      }
      this.removedTriangles.push(t)
    }
  }

  ProcessRightFrontPiercedElement() {
    let v = this.piercedToTheRightFrontElemNode
    do {
      this.elementsToBeRemovedFromFront.push(v.item)
      this.AddSiteToRightPolygon(v.item.RightSite)
      v = this.front.next(v)
    } while (Point.pointToTheRightOfLine(v.item.RightSite.point, this.a.point, this.b.point)) //that is why we are adding to the right polygon
    this.elementsToBeRemovedFromFront.push(v.item)
    this.AddSiteToLeftPolygon(v.item.RightSite)
    if (v.item.RightSite === this.b) {
      this.piercedToTheRightFrontElemNode = v //this will stop the traversal
      return
    }
    this.FindPiercedTriangle(v)
    this.piercedToTheRightFrontElemNode = null
  }

  AddSiteToLeftPolygon(site: CdtSite) {
    this.AddSiteToPolygonWithCheck(site, this.leftPolygon)
  }

  AddSiteToPolygonWithCheck(site: CdtSite, list: Array<CdtSite>) {
    if (site === this.b) {
      return
    }

    if (list.length === 0 || list[list.length - 1] !== site) {
      list.push(site)
    }
  }

  AddSiteToRightPolygon(site: CdtSite) {
    this.AddSiteToPolygonWithCheck(site, this.rightPolygon)
  }

  BIsReached(): boolean {
    const node = this.piercedToTheLeftFrontElemNode ?? this.piercedToTheRightFrontElemNode
    if (node != null) {
      return node.item.Edge.IsAdjacent(this.b)
    }

    return this.piercedEdge.IsAdjacent(this.b)
  }

  initEdgeTracer() {
    this.a = this.traversingEdge.upperSite
    this.b = this.traversingEdge.lowerSite
    this.removedTriangles = []
    //            if (CdtSweeper.D)
    //                CdtSweeper.ShowFront(triangles, front, new[] {new LineSegment(a.point, b.point)},null);
    // new[] {new LineSegment(piercedEdge.upperSite.point, piercedEdge.lowerSite.point)});
    const frontElemNodeRightOfA = CdtSweeper.FindNodeInFrontBySite(this.front, this.a)
    const frontElemNodeLeftOfA = this.front.previous(frontElemNodeRightOfA)
    if (Point.pointToTheLeftOfLine(this.b.point, frontElemNodeLeftOfA.item.LeftSite.point, frontElemNodeLeftOfA.item.RightSite.point)) {
      this.piercedToTheLeftFrontElemNode = frontElemNodeLeftOfA
    } else if (
      Point.pointToTheRightOfLine(this.b.point, frontElemNodeRightOfA.item.RightSite.point, frontElemNodeRightOfA.item.LeftSite.point)
    ) {
      this.piercedToTheRightFrontElemNode = frontElemNodeRightOfA
    } else {
      for (const e of this.a.Edges) {
        const t = e.CcwTriangle
        if (t == null) {
          continue
        }

        if (Point.pointToTheLeftOfLine(this.b.point, e.lowerSite.point, e.upperSite.point)) {
          continue
        }

        const eIndex = t.Edges.index(e)
        const site = t.Sites.getItem(eIndex + 2)
        if (Point.pointToTheLeftOfLineOrOnLine(this.b.point, site.point, e.upperSite.point)) {
          this.piercedEdge = t.Edges.getItem(eIndex + 1)
          this.piercedTriangle = t
          // CdtSweeper.ShowFront(triangles, front, new[] { new LineSegment(e.upperSite.point, e.lowerSite.point) },
          // new[] { new LineSegment(piercedEdge.upperSite.point, piercedEdge.lowerSite.point) });
          break
        }
      }
    }
  }
}
