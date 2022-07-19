import {Attribute} from '../../structs/attribute'
import {Entity} from '../../structs/entity'
import {Rectangle} from '../../math/geometry/rectangle'

export abstract class AlgorithmData extends Attribute {
  static attachIndex = 4
  constructor(entity: Entity) {
    super(entity, AlgorithmData.attachIndex)
  }
  static getAlgData(attrCont: Entity): AlgorithmData {
    return attrCont.getAttr(AlgorithmData.attachIndex)
  }
  data: any
}
