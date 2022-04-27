import {ICurve, Point} from '../../..'
import {compareNumbersDistEps} from '../../../utils/compare'
import {BundleInfo} from './BundleInfo'
import {OrientedHubSegment} from './OrientedHubSegment'

export class BundleBase {
  //  only one of those is not null
  OutgoingBundleInfo: BundleInfo
  IncomingBundleInfo: BundleInfo

  private points: Point[]

  private tangents: Point[]

  OrientedHubSegments: OrientedHubSegment[]

  //  the boundary of a cluster or a hub containing this base
  Curve: ICurve

  //  this bundle base sits on a cluster boundary and the opposite base sits on a child of the cluster
  IsParent: boolean

  //  if true then the base sits on a real node or cluster, otherwise it belongs to an intermediate hub
  BelongsToRealNode: boolean

  //  position of the station containing the base
  //  (could be a center of a hub, or a point on the boundary of a cluster)
  Position: Point

  get Count() {
    return this.points.length
  }

  constructor(count: number, boundaryCurve: ICurve, position: Point, belongsToRealNode: boolean) {
    this.BelongsToRealNode = belongsToRealNode
    this.Curve = boundaryCurve
    this.Position = position
    this.points = new Array(count)
    this.tangents = new Array(count)
    this.OrientedHubSegments = new Array(count)
    this.ParameterSpan = this.Curve.parEnd - this.Curve.parStart
  }

  get CurveCenter(): Point {
    return this.Curve.boundingBox.center
  }

  get OppositeBase(): BundleBase {
    return this.OutgoingBundleInfo != null ? this.OutgoingBundleInfo.TargetBase : this.IncomingBundleInfo.SourceBase
  }

  get length(): number {
    return this.points.length
  }

  get Points(): Point[] {
    return this.points
  }

  get Tangents(): Point[] {
    return this.tangents
  }

  initialMidParameter: number

  get InitialMidParameter(): number {
    return this.initialMidParameter
  }
  set InitialMidParameter(value: number) {
    this.initialMidParameter = value
    this.InitialMidPoint = this.Curve.value(value)
  }

  InitialMidPoint: Point

  parRight: number

  //  corresponds to the left point of the base
  get ParRight(): number {
    return this.parRight
  }
  set ParRight(value: number) {
    this.parRight = value
    this.RightPoint = this.Curve.value(this.parRight)
  }

  parLeft: number

  //  corresponds to the right point of the base
  get ParLeft(): number {
    return this.parLeft
  }
  set ParLeft(value: number) {
    this.parLeft = value
    this.LeftPoint = this.Curve.value(this.parLeft)
  }

  get ParMid(): number {
    return (this.parRight + this.parLeft) / 2
  }

  RightPoint: Point
  LeftPoint: Point
  get MidPoint(): Point {
    return Point.middle(this.RightPoint, this.LeftPoint)
  }

  // previous in ccw order
  Prev: BundleBase

  // next in ccw order
  Next: BundleBase

  ParameterSpan: number

  get Span(): number {
    return this.SpanBetweenTwoPoints(this.parRight, this.parLeft)
  }

  SpanBetweenTwoPoints(right: number, left: number): number {
    return right <= left ? left - right : left - right + this.ParameterSpan
  }

  RotateLeftPoint(rotationOfSourceLeftPoint: number, parameterChange: number): Point {
    if (rotationOfSourceLeftPoint == 0) {
      return this.LeftPoint
    }

    return this.RotatePoint(rotationOfSourceLeftPoint, this.parLeft, parameterChange)
  }

  RotateRigthPoint(rotationOfSourceRightPoint: number, parameterChange: number): Point {
    if (rotationOfSourceRightPoint == 0) {
      return this.RightPoint
    }

    return this.RotatePoint(rotationOfSourceRightPoint, this.parRight, parameterChange)
  }

  RotatePoint(rotation: number, t: number, parameterChange: number): Point {
    const change = this.ParameterSpan * parameterChange

    t += rotation * change
    t = this.AdjustParam(t)

    return this.Curve.value(t)
  }

  AdjustParam(t: number): number {
    if (t > this.Curve.parEnd) t = this.Curve.parStart + (t - this.Curve.parEnd)
    else if (t < this.Curve.parStart) t = this.Curve.parEnd - (this.Curve.parStart - t)
    return t
  }

  RotateBy(rotationOfRightPoint: number, rotationOfLeftPoint: number, parameterChange: number) {
    const change: number = this.ParameterSpan * parameterChange
    if (rotationOfRightPoint != 0) {
      this.ParRight = this.AdjustParam(this.ParRight + rotationOfRightPoint * change)
    }

    if (rotationOfLeftPoint != 0) {
      this.ParLeft = this.AdjustParam(this.ParLeft + rotationOfLeftPoint * change)
    }
  }

  Intersect(other: BundleBase): boolean {
    return this.IntersectNNNB(this.parRight, this.parLeft, other.parRight, other.parLeft)
  }

  IntersectNNNB(lParRight: number, lParLeft: number, rParRight: number, rParLeft: number): boolean {
    if (lParRight > lParLeft) {
      return (
        this.IntersectNNNB(lParRight, this.Curve.parEnd, rParRight, rParLeft) ||
        this.IntersectNNNB(this.Curve.parStart, lParLeft, rParRight, rParLeft)
      )
    }

    if (rParRight > rParLeft) {
      return (
        this.IntersectNNNB(lParRight, lParLeft, rParRight, this.Curve.parEnd) ||
        this.IntersectNNNB(lParRight, lParLeft, this.Curve.parStart, rParLeft)
      )
    }

    //Assert.assert(lParRight <= lParLeft)
    //Assert.assert(rParRight <= rParLeft)
    if (compareNumbersDistEps(lParLeft, rParRight)) {
      return false
    }

    if (compareNumbersDistEps(rParLeft, lParRight)) {
      return false
    }

    return true
  }

  RelativeOrderOfBasesIsPreserved(rotationOfRightPoint: number, rotationOfLeftPoint: number, parameterChange: number): boolean {
    const change = this.ParameterSpan * parameterChange

    //we do not swap parRight and parLeft
    const rnew = this.parRight + rotationOfRightPoint * change
    const lnew =
      this.parRight < this.parLeft
        ? this.parLeft + rotationOfLeftPoint * change
        : this.parLeft + this.ParameterSpan + rotationOfLeftPoint * change
    if (rnew > lnew) return false

    //span could not be greater than pi
    if (this.SpanBetweenTwoPoints(rnew, lnew) > this.ParameterSpan / 2.0) return false

    //the base is the only base in the hub
    if (this.Prev == null) return true

    //distance between mid points is larger than parameterChange => we can't change the order
    if (
      this.SpanBetweenTwoPoints(this.Prev.ParMid, this.ParMid) > change &&
      this.SpanBetweenTwoPoints(this.ParMid, this.Next.ParMid) > change
    )
      return true

    const rSoP = this.RotateLeftPoint(rotationOfLeftPoint, parameterChange)
    const lSoP = this.RotateRigthPoint(rotationOfRightPoint, parameterChange)
    const newMidPoint = Point.middle(rSoP, lSoP)
    const curMidPoint = this.MidPoint

    //check Prev
    if (
      Point.getTriangleOrientation(this.CurveCenter, this.Prev.MidPoint, curMidPoint) !=
      Point.getTriangleOrientation(this.CurveCenter, this.Prev.MidPoint, newMidPoint)
    )
      return false

    //Next
    if (
      Point.getTriangleOrientation(this.CurveCenter, this.Next.MidPoint, curMidPoint) !=
      Point.getTriangleOrientation(this.CurveCenter, this.Next.MidPoint, newMidPoint)
    )
      return false

    return true
  }
}
