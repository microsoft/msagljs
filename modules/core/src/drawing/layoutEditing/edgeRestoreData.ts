import {GeomEdge} from '../../layout/core'
import {Point, Curve, Polyline, ICurve} from '../../math/geometry'
import {SmoothedPolyline} from '../../math/geometry/smoothedPolyline'

export class EdgeRestoreData {
  labelCenter: Point
  underlyingPolyline: SmoothedPolyline
  curve_: ICurve
  arrowheadAtSourcePosition_: Point

  constructor(edge: GeomEdge) {
    if (edge.underlyingPolyline == null) {
      if (edge.curve instanceof Curve) {
        edge.underlyingPolyline = SmoothedPolyline.mkFromPoints(
          [edge.source.center].concat(Array.from(Polyline.polylineFromCurve(edge.curve))).concat([edge.target.center]),
        )
      } else {
        edge.underlyingPolyline = SmoothedPolyline.mkFromPoints([edge.source.center, edge.curve.start, edge.curve.end, edge.target.center])
      }
    }

    this.UnderlyingPolyline = edge.underlyingPolyline.clone()
    this.Curve = edge.curve.clone()
    if (edge.sourceArrowhead != null) {
      this.ArrowheadAtSourcePosition = edge.sourceArrowhead.tipPosition.clone()
    }

    if (edge.targetArrowhead != null) {
      this.ArrowheadAtTargetPosition = edge.targetArrowhead.tipPosition.clone()
    }

    if (edge.label != null && edge.underlyingPolyline != null) {
      this.labelCenter = edge.label.center.clone()
      const untrimmedCurve: Curve = edge.underlyingPolyline.createCurve()
      this.LabelAttachmentParameter = untrimmedCurve.closestParameter(this.labelCenter)
      this.LabelOffsetFromTheAttachmentPoint = this.labelCenter.sub(untrimmedCurve.value(this.LabelAttachmentParameter))
    }
  }
  Action: () => void

  //  the underlying polyline

  public get UnderlyingPolyline(): SmoothedPolyline {
    return this.underlyingPolyline
  }
  public set UnderlyingPolyline(value: SmoothedPolyline) {
    this.underlyingPolyline = value
  }

  //  the initial center

  public get LabelCenter(): Point {
    return this.labelCenter
  }
  public set LabelCenter(value: Point) {
    this.labelCenter = value
  }

  //  the edge original curve
  public get Curve(): ICurve {
    return this.curve_
  }
  public set Curve(value: ICurve) {
    this.curve_ = value
  }

  //  the arrow head position at source

  public get ArrowheadAtSourcePosition(): Point {
    return this.arrowheadAtSourcePosition_
  }
  public set ArrowheadAtSourcePosition(value: Point) {
    this.arrowheadAtSourcePosition_ = value
  }

  ArrowheadAtTargetPosition: Point

  LabelOffsetFromTheAttachmentPoint: Point

  LabelAttachmentParameter: number
}
