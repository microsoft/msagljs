import {Entity} from '../../structs/entity'
import {Rectangle} from './../../math/geometry/rectangle'
export abstract class GeomObject {
  abstract boundingBox: Rectangle
  entity: Entity
  bind() {
    if (this.entity) this.entity.setAttr(0, this)
  }

  constructor(attrCont: Entity) {
    this.entity = attrCont
    this.bind()
  }

  static getGeom(attrCont: Entity): GeomObject {
    return attrCont.getAttr(0)
  }
}
