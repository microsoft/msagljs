import {Attribute} from '../../structs/attribute'
import {AttributeRegistry} from '../../structs/attributeRegister'
import {Entity} from '../../structs/entity'
import {EventHandler} from '../layoutEditing/eventHandler'
import {Rectangle} from './../../math/geometry/rectangle'
import {GeomLabel} from './geomLabel'
export abstract class GeomObject extends Attribute {
  abstract boundingBox: Rectangle
  BeforeLayoutChangeEvent: EventHandler
  constructor(entity: Entity) {
    super(entity, AttributeRegistry.GeomObjectIndex)
  }
  static getGeom(attrCont: Entity): GeomObject {
    return attrCont.getAttr(AttributeRegistry.GeomObjectIndex)
  }
  get parent(): GeomObject {
    const p = this.entity.parent
    return p ? GeomObject.getGeom(p) : null
  }
  label: GeomLabel
}
