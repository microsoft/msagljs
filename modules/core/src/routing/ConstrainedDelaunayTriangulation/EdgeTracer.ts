import {Point} from '../../math/geometry/point'
import {RBNode} from '../../structs/RBTree/rbNode'
import {RBTree} from '../../structs/RBTree/rbTree'

import {RealNumberSpan} from '../../utils/RealNumberSpan'
import {CdtEdge} from './CdtEdge'
import {CdtFrontElement} from './CdtFrontElement'
import {CdtSite} from './CdtSite'
import {CdtSweeper} from './CdtSweeper'
import {CdtTriangle} from './CdtTriangle'

export class EdgeTracer {
  readonly edge: CdtEdge
  readonly triangles: Set<CdtTriangle>
  readonly front: RBTree<CdtFrontElement>
  readonly leftPolygon: Array<CdtSite>
  readonly rightPolygon: Array<CdtSite>

  // the upper site of the edge
  a: CdtSite
  // the lower site of the edge
  b: CdtSite
  piercedEdge: CdtEdge
  piercedTriangle: CdtTriangle
  piercedToTheLeftFrontElemNode: RBNode<CdtFrontElement>
  piercedToTheRightFrontElemNode: RBNode<CdtFrontElement>
  elementsToBeRemovedFromFront = new Array<CdtFrontElement>()
  removedTriangles = new Array<CdtTriangle>()

  constructor(
    edge: CdtEdge,
    triangles: Set<CdtTriangle>,
    front: RBTree<CdtFrontElement>,
    leftPolygon: Array<CdtSite>,
    rightPolygon: Array<CdtSite>,
  ) {
    this.edge = edge
    this.triangles = triangles
    this.front = front
    this.leftPolygon = leftPolygon
    this.rightPolygon = rightPolygon
    this.a = edge.upperSite
    this.b = edge.lowerSite
  }

  Run() {
    this.Init()
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
    if (v.item.LeftSite == this.b) {
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
    const eIndex = t.TriEdges.index(e)
    for (let i = 1; i <= 2; i++) {
      const ei = t.TriEdges.getItem(i + eIndex)
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
      for (const e of triangle.TriEdges) {
        if (e.CcwTriangle == null && e.CwTriangle == null) {
          const site = e.upperSite.point.x < e.lowerSite.point.x ? e.upperSite : e.lowerSite
          const frontNode = CdtSweeper.FindNodeInFrontBySite(this.front, site)
          if (frontNode.item.Edge == e) {
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
    if (this.piercedEdge.CcwTriangle == this.piercedTriangle) {
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
    const eIndex = t.TriEdges.index(this.piercedEdge)
    for (let i = 1; i <= 2; i++) {
      const e = t.TriEdges.getItem(i + eIndex)
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
    for (const e of t.TriEdges) {
      if (e.CwTriangle == t) {
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
    if (v.item.RightSite == this.b) {
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
    if (site == this.b) {
      return
    }

    if (list.length == 0 || list[list.length - 1] != site) {
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

  Init() {
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

        const eIndex = t.TriEdges.index(e)
        const site = t.Sites.getItem(eIndex + 2)
        if (Point.pointToTheLeftOfLineOrOnLine(this.b.point, site.point, e.upperSite.point)) {
          this.piercedEdge = t.TriEdges.getItem(eIndex + 1)
          this.piercedTriangle = t
          // CdtSweeper.ShowFront(triangles, front, new[] { new LineSegment(e.upperSite.point, e.lowerSite.point) },
          // new[] { new LineSegment(piercedEdge.upperSite.point, piercedEdge.lowerSite.point) });
          break
        }
      }
    }
  }
}
