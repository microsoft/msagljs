import {Attribute} from './attribute'
import {AttributeRegistry} from './attributeRegister'
import {Entity} from './entity'

export class AlgorithmData extends Attribute {
  constructor(entity: Entity, data: any = null) {
    super(entity, AttributeRegistry.AlgorithmDataIndex)
    this.data = data
  }
  static getAlgData(attrCont: Entity): AlgorithmData {
    return attrCont.getAttr(AttributeRegistry.AlgorithmDataIndex)
  }
  data: any
}
