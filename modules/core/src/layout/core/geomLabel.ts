import {GeomObject} from './geomObject'
import {Rectangle, Size} from './../../math/geometry/rectangle'
import {Label} from '../../structs/label'
import {Point} from '../..'

export class GeomLabel extends GeomObject {
  constructor(size: Size, label: Label) {
    super(label)
    /*Assert.assert(label instanceof Label)*/
    this.boundingBox = Rectangle.mkPP(new Point(0, 0), new Point(size.width, size.height))
  }
  get label() {
    return <Label>this.entity
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
    return center.x != -77 || center.y != -77
  }
  /** mark the label as not having a position */
  requirePositioning() {
    this.boundingBox.center = new Point(-77, -77)
  }
}
