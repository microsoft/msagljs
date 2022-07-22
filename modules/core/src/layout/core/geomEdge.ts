import {GeomNode} from './geomNode'
import {Edge, ToAncestorEnum} from './../../structs/edge'
import {GeomObject} from './geomObject'
import {Rectangle} from './../../math/geometry/rectangle'
import {ICurve} from './../../math/geometry/icurve'
import {SmoothedPolyline} from './../../math/geometry/smoothedPolyline'
import {GeomLabel} from './geomLabel'
import {PlaneTransformation} from '../../math/geometry/planeTransformation'
import {Port} from './port'
import {Point} from '../../math/geometry/point'
import {Arrowhead} from './arrowhead'

export class GeomEdge extends GeomObject {
  RaiseLayoutChangeEvent(delta: Point) {
    this.edge.raiseEvents(delta)
  }
  requireRouting() {
    this.curve = null
    this.underlyingPolyline = null
  }
  private _sourcePort: Port
  public get sourcePort(): Port {
    return this._sourcePort
  }
  public set sourcePort(value: Port) {
    this._sourcePort = value
  }
  private _targetPort: Port
  public get targetPort(): Port {
    return this._targetPort
  }
  public set targetPort(value: Port) {
    this._targetPort = value
  }
  curve: ICurve
  smoothedPolyline: SmoothedPolyline

  sourceArrowhead: Arrowhead

  targetArrowhead: Arrowhead

  lineWidth = 1

  translate(delta: Point) {
    if (delta.x == 0 && delta.y == 0) return
    // RaiseLayoutChangeEvent(delta);
    if (this.curve != null) this.curve.translate(delta)

    if (this.smoothedPolyline != null)
      for (let s = this.smoothedPolyline.headSite, s0 = this.smoothedPolyline.headSite; s != null; s = s.next, s0 = s0.next)
        s.point = s0.point.add(delta)

    if (this.sourceArrowhead != null) this.sourceArrowhead.tipPosition = this.sourceArrowhead.tipPosition.add(delta)
    if (this.targetArrowhead != null) this.targetArrowhead.tipPosition = this.targetArrowhead.tipPosition.add(delta)
  }

  GetMaxArrowheadLength(): number {
    let l = 0
    if (this.sourceArrowhead != null) {
      l = this.sourceArrowhead.length
    }

    if (this.targetArrowhead != null && this.targetArrowhead.length > l) {
      return this.targetArrowhead.length
    }

    return l
  }

  transform(matrix: PlaneTransformation) {
    if (this.curve == null) return
    this.curve = this.curve.transform(matrix)
    if (this.underlyingPolyline != null)
      for (let s = this.underlyingPolyline.headSite, s0 = this.underlyingPolyline.headSite; s != null; s = s.next, s0 = s0.next)
        s.point = matrix.multiplyPoint(s.point)

    if (this.sourceArrowhead != null) {
      this.sourceArrowhead.tipPosition = matrix.multiplyPoint(this.sourceArrowhead.tipPosition)
    }
    if (this.targetArrowhead != null) {
      this.targetArrowhead.tipPosition = matrix.multiplyPoint(this.targetArrowhead.tipPosition)
    }

    if (this.label != null) this.label.center = matrix.multiplyPoint(this.label.center)
  }
  underlyingPolyline: SmoothedPolyline
  label: GeomLabel
  get labelBBox() {
    return this.label.boundingBox
  }
  get edge(): Edge {
    return this.entity as Edge
  }
  get source(): GeomNode {
    return GeomObject.getGeom(this.edge.source) as GeomNode
  }

  get boundingBox(): Rectangle {
    const rect = Rectangle.mkEmpty()
    if (this.underlyingPolyline != null) for (const p of this.underlyingPolyline) rect.add(p)

    if (this.curve != null) rect.addRecSelf(this.curve.boundingBox)

    if (this.sourceArrowhead != null) rect.add(this.sourceArrowhead.tipPosition)
    if (this.targetArrowhead != null) rect.add(this.targetArrowhead.tipPosition)
    if (this.edge.label) {
      rect.addRecSelf(this.label.boundingBox)
    }

    const del = this.lineWidth
    rect.left -= del
    rect.top += del
    rect.right += del
    rect.bottom -= del
    return rect
  }

  isInterGraphEdge(): boolean {
    return this.edge.isInterGraphEdge()
  }

  get target(): GeomNode {
    return GeomObject.getGeom(this.edge.target) as GeomNode
  }

  constructor(edge: Edge) {
    super(edge)
  }
  toString() {
    return this.source.toString() + '->' + this.target
  }

  static RouteSelfEdge(boundaryCurve: ICurve, howMuchToStickOut: number, t: {smoothedPolyline: SmoothedPolyline}): ICurve {
    // we just need to find the box of the corresponding node
    const w = boundaryCurve.boundingBox.width
    const h = boundaryCurve.boundingBox.height
    const center = boundaryCurve.boundingBox.center
    const p0 = new Point(center.x - w / 4, center.y)
    const p1 = new Point(center.x - w / 4, center.y - h / 2 - howMuchToStickOut)
    const p2 = new Point(center.x + w / 4, center.y - h / 2 - howMuchToStickOut)
    const p3 = new Point(center.x + w / 4, center.y)
    t.smoothedPolyline = SmoothedPolyline.mkFromPoints([p0, p1, p2, p3])
    return t.smoothedPolyline.createCurve()
  }

  underCollapsedGraph(): boolean {
    return this.source.underCollapsedGraph() || this.target.underCollapsedGraph()
  }
  EdgeToAncestor(): ToAncestorEnum {
    return this.edge.EdgeToAncestor()
  }
}
