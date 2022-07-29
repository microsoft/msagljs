import {Rectangle} from '../../math/geometry/rectangle'
import {Point} from '../../math/geometry/point'
import {Curve, CurveFactory} from '../../math/geometry'

export class RRect extends Rectangle {
  isOk(): boolean {
    if (this.isEmpty()) {
      return true
    }
    return this.roundedRect_.boundingBox.equalEps(this)
  }
  setRect(value: Rectangle) {
    super.left_ = value.left
    super.right_ = value.right
    super.top_ = value.top
    super.bottom_ = value.bottom
    if (!this.isEmpty()) {
      this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(value.width, value.height, this.radX, this.radY, super.center)
    }
  }
  radX: number
  radY: number
  roundedRect_: Curve
  boundingBox_: Rectangle
  constructor(t: {left: number; right: number; top: number; bottom: number; radX: number; radY: number}) {
    super(t)
    this.radX = t.radX
    this.radY = t.radY
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, t.radX, t.radY, super.center)
  }
  get center() {
    return super.center
  }
  set center(value: Point) {
    super.center = value
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, this.radX, this.radY, super.center)
    // Assert.assert(this.isOk())
  }
  get left() {
    return super.left
  }
  set left(value: number) {
    super.left = value
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, this.radX, this.radY, super.center)
  }
  get right(): number {
    return super.right
  }
  set right(value: number) {
    super.right = value
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, this.radX, this.radY, super.center)
  }
  get top() {
    return super.top
  }

  set top(value: number) {
    super.top = value
    this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, this.radX, this.radY, super.center) // todo: optimize
  }
  get bottom() {
    return super.bottom
  }

  set bottom(value: number) {
    super.bottom = value
    if (!this.isEmpty)
      this.roundedRect_ = CurveFactory.mkRectangleWithRoundedCorners(super.width, super.height, this.radX, this.radY, super.center) // todo: optimize
  }
}
