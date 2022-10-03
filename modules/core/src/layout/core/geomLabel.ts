import {Rectangle, Size} from './../../math/geometry/rectangle'

import {PlaneTransformation} from '../../math/geometry/planeTransformation'
import {Point} from '../../math/geometry'
import {GeomObject} from './geomObject'
import {Label} from '../../structs/label'

export class GeomLabel extends GeomObject {
  private _isPositioned = false
  public get isPositioned(): boolean {
    return this._isPositioned
  }
  public set isPositioned(value: boolean) {
    this._isPositioned = value
  }
  /** this field is needed for interactive editing */
  AttachmentSegmentEnd: Point
  /** this field is needed for interactive editing */
  AttachmentSegmentStart: Point
  constructor(entity: Label, size: Size) {
    super(entity)
    if (size) {
      this.boundingBox = Rectangle.mkPP(new Point(0, 0), new Point(size.width, size.height))
    }
  }
  private _boundingBox: Rectangle
  public get boundingBox(): Rectangle {
    return this._boundingBox
  }
  private set boundingBox(value: Rectangle) {
    this._boundingBox = value
  }

  setBoundingBox(b: Rectangle) {
    this.isPositioned = true
    this._boundingBox = b
  }
  get width() {
    return this.boundingBox.width
  }
  set width(value) {
    this.boundingBox.width = value
  }
  get height() {
    return this.boundingBox.height
  }
  set height(value) {
    this.boundingBox.height = value
  }

  get center() {
    return this.boundingBox.center
  }
  private set center(value) {
    this.boundingBox.center = value
  }
  translate(delta: Point) {
    if (this.isPositioned) this.center = this.center.add(delta)
  }
  transform(m: PlaneTransformation) {
    if (this.isPositioned) this.center = m.multiplyPoint(this.center)
  }
  positionCenter(p: Point) {
    this.boundingBox.center = p
    this.isPositioned = true
  }
}
