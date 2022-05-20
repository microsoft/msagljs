import {Entity} from '../../structs/entity'
import {Rectangle} from './../../math/geometry/rectangle'
export abstract class GeomObject {
  static attachIndex = 0
  abstract boundingBox: Rectangle
  /**  This is the field from the Graph. It is used to keep the connection with the underlying graph */
  entity: Entity
  bind() {
    if (this.entity) this.entity.setAttr(GeomObject.attachIndex, this)
  }

  constructor(attrCont: Entity) {
    this.entity = attrCont
    this.bind()
  }

  static getGeom(attrCont: Entity): GeomObject {
    return attrCont.getAttr(GeomObject.attachIndex)
  }
}
