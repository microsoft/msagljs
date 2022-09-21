import {Attribute} from '../../structs/attribute'
import {AttributeRegistry} from '../../structs/attributeRegister'
import {Entity} from '../../structs/entity'
import {Rectangle} from './../../math/geometry/rectangle'
import {GeomLabel} from './geomLabel'
/** represents the set of functions to handle an event */
export class EventHandler {
  forEach(action: (a: any) => any) {
    this.actions.forEach((a) => a(action, null))
  }
  private actions: Set<(a: any, b: any) => void>
  subscribe(f: (a: any, b: any) => void) {
    this.actions.add(f)
  }
  unsubscribe(f: (a: any, b: any) => void) {
    this.actions.delete(f)
  }
  raise(a: any, b: any) {
    this.actions.forEach((f) => f(a, b))
  }
}

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
