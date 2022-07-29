import {Attribute} from './attribute'
import {Entity} from './entity'

export class AlgorithmData extends Attribute {
  static attachIndex = 4
  constructor(entity: Entity, data: any = null) {
    super(entity, AlgorithmData.attachIndex)
    this.data = data
  }
  static getAlgData(attrCont: Entity): AlgorithmData {
    return attrCont.getAttr(AlgorithmData.attachIndex)
  }
  data: any
}
