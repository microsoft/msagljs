import {Rectangle, Size} from './../../math/geometry/rectangle'
import {GeomObject, Point} from '../..'

export class GeomLabel {
  /** this field is needed for interactive editing */
  AttachmentSegmentEnd: Point
  /** this field is needed for interactive editing */
  AttachmentSegmentStart: Point
  parent: GeomObject
  constructor(size: Size, parent: GeomObject) {
    /*Assert.assert(label instanceof Label)*/
    if (size) this.boundingBox = Rectangle.mkPP(new Point(0, 0), new Point(size.width, size.height))
    this.parent = parent
  }
  boundingBox: Rectangle
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
  set center(value) {
    this.boundingBox.center = value
  }

  public get isPositioned() {
    const center = this.center
    return center.x !== -77 || center.y !== -77
  }
  /** mark the label as not having a position */
  requirePositioning() {
    this.boundingBox.center = new Point(-77, -77)
  }
}
