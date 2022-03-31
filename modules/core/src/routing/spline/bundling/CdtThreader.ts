import {Point} from '../../..'
import {PointLocation, GeomConstants} from '../../../math/geometry'
import {TriangleOrientation} from '../../../math/geometry/point'

import {CdtEdge} from '../../ConstrainedDelaunayTriangulation/CdtEdge'
import {CdtSite} from '../../ConstrainedDelaunayTriangulation/CdtSite'
import {CdtTriangle} from '../../ConstrainedDelaunayTriangulation/CdtTriangle'

export class CdtThreader {
  start: Point

  end: Point

  positiveSign: number

  negativeSign: number

  private currentPiercedEdge: CdtEdge

  get CurrentPiercedEdge(): CdtEdge {
    return this.currentPiercedEdge
  }

  private currentTriangle: CdtTriangle

  get CurrentTriangle(): CdtTriangle {
    return this.currentTriangle
  }

  constructor(startTriangle: CdtTriangle, start: Point, end: Point) {
    this.currentTriangle = startTriangle
    this.start = start
    this.end = end
    //Assert.assert(CdtThreader.PointLocationForTriangle(start, startTriangle) != PointLocation.Outside)
  }

  *Triangles(): IterableIterator<CdtTriangle> {
    while (this.MoveNext()) yield this.CurrentTriangle
  }

  FindFirstPiercedEdge(): CdtEdge {
    //Assert.assert(CdtThreader.PointLocationForTriangle(this.start, this.currentTriangle) != PointLocation.Outside)
    //Assert.assert(CdtThreader.PointLocationForTriangle(this.end, this.currentTriangle) == PointLocation.Outside)
    const sign0 = this.GetHyperplaneSign(this.currentTriangle.Sites.item0)
    const sign1 = this.GetHyperplaneSign(this.currentTriangle.Sites.item1)
    if (sign0 != sign1) {
      if (
        Point.getTriangleOrientation(this.end, this.currentTriangle.Sites.item0.point, this.currentTriangle.Sites.item1.point) ==
        TriangleOrientation.Clockwise
      ) {
        this.positiveSign = sign0
        this.negativeSign = sign1
        return this.currentTriangle.TriEdges.item0
      }
    }

    const sign2 = this.GetHyperplaneSign(this.currentTriangle.Sites.item2)
    if (sign1 != sign2) {
      if (
        Point.getTriangleOrientation(this.end, this.currentTriangle.Sites.item1.point, this.currentTriangle.Sites.item2.point) ==
        TriangleOrientation.Clockwise
      ) {
        this.positiveSign = sign1
        this.negativeSign = sign2
        return this.currentTriangle.TriEdges.item1
      }
    }

    this.positiveSign = sign2
    this.negativeSign = sign0
    //Assert.assert(this.positiveSign > this.negativeSign)
    return this.currentTriangle.TriEdges.item2
  }

  static PointLocationForTriangle(p: Point, triangle: CdtTriangle): PointLocation {
    let seenBoundary = false
    for (let i = 0; i < 3; i++) {
      const area = Point.signedDoubledTriangleArea(p, triangle.Sites.getItem(i).point, triangle.Sites.getItem(i + 1).point)
      if (area < GeomConstants.distanceEpsilon * -1) {
        return PointLocation.Outside
      }

      if (area < GeomConstants.distanceEpsilon) {
        seenBoundary = true
      }
    }

    return seenBoundary ? PointLocation.Boundary : PointLocation.Inside
  }

  FindNextPierced() {
    //Assert.assert(this.negativeSign < this.positiveSign)
    this.currentTriangle = this.currentPiercedEdge.GetOtherTriangle_T(this.currentTriangle)
    //             ShowDebug(null,currentPiercedEdge,currentTriangle);
    if (this.currentTriangle == null) {
      this.currentPiercedEdge = null
      return
    }

    const i = this.currentTriangle.TriEdges.index(this.currentPiercedEdge)
    let j: number
    // pierced index
    const oppositeSite = this.currentTriangle.Sites.getItem(i + 2)
    const oppositeSiteSign = this.GetHyperplaneSign(oppositeSite)
    if (this.negativeSign == 0) {
      //Assert.assert(this.positiveSign == 1)
      if (oppositeSiteSign == -1 || oppositeSiteSign == 0) {
        this.negativeSign = oppositeSiteSign
        j = i + 1
      } else {
        j = i + 2
      }
    } else if (this.positiveSign == 0) {
      //Assert.assert(this.negativeSign == -1)
      if (oppositeSiteSign == 1 || oppositeSiteSign == 0) {
        this.positiveSign = oppositeSiteSign
        j = i + 2
      } else {
        j = i + 1
      }
    } else if (oppositeSiteSign != this.positiveSign) {
      this.negativeSign = oppositeSiteSign
      j = i + 1
    } else {
      //Assert.assert(this.negativeSign != oppositeSiteSign)
      this.positiveSign = oppositeSiteSign
      j = i + 2
    }

    this.currentPiercedEdge =
      Point.signedDoubledTriangleArea(
        this.end,
        this.currentTriangle.Sites.getItem(j).point,
        this.currentTriangle.Sites.getItem(j + 1).point,
      ) < -GeomConstants.distanceEpsilon
        ? this.currentTriangle.TriEdges.getItem(j)
        : null
  }

  //         void ShowDebug(Array<CdtTriangle> cdtTriangles, CdtEdge cdtEdge, CdtTriangle cdtTriangle) {
  //             var l = new Array<DebugCurve> { new DebugCurve(10,"red",new LineSegment(start,end)) };
  //             if(cdtEdge!=null)
  //                 l.Add(new DebugCurve(100,3,"navy", new LineSegment(cdtEdge.upperSite.point,cdtEdge.lowerSite.point)));
  //             AddTriangleToListOfDebugCurves(l,cdtTriangle,100,2,"brown");
  //             LayoutAlgorithmSettings.ShowDebugCurvesEnumeration(l);
  //
  //         }
  //         static void AddTriangleToListOfDebugCurves(Array<DebugCurve> debugCurves,CdtTriangle triangle,byte transparency,double width,string color) {
  //             foreach(var cdtEdge of triangle.Edges) {
  //                 debugCurves.Add(new DebugCurve(transparency,width,color,new LineSegment(cdtEdge.upperSite.point,cdtEdge.lowerSite.point)));
  //             }
  //         }
  GetHyperplaneSign(cdtSite: CdtSite): number {
    const area = Point.signedDoubledTriangleArea(this.start, cdtSite.point, this.end)
    if (area > GeomConstants.distanceEpsilon) {
      return 1
    }

    if (area < GeomConstants.distanceEpsilon * -1) {
      return -1
    }

    return 0
  }

  MoveNext(): boolean {
    if (this.currentPiercedEdge == null) {
      this.currentPiercedEdge = this.FindFirstPiercedEdge()
    } else {
      this.FindNextPierced()
    }

    return this.currentPiercedEdge != null
  }
}
