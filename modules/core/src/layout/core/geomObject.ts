import {Attribute} from '../../structs/attribute'
import {Entity} from '../../structs/entity'
import {Rectangle} from './../../math/geometry/rectangle'
import {GeomLabel} from './geomLabel'
export abstract class GeomObject extends Attribute {
  static attachIndex = 0
  abstract boundingBox: Rectangle
  constructor(entity: Entity) {
    super(entity, GeomObject.attachIndex)
  }
  static getGeom(attrCont: Entity): GeomObject {
    return attrCont.getAttr(GeomObject.attachIndex)
  }
  get parent(): GeomObject {
    const p = this.entity.parent
    return p ? GeomObject.getGeom(p) : null
  }
  label: GeomLabel
}
