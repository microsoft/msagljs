import {ArrowTypeEnum} from './arrowTypeEnum'
import {DrawingObject} from './drawingObject'

export class DrawingEdge extends DrawingObject {
  directed = true
  arrowtail: ArrowTypeEnum
  arrowhead: ArrowTypeEnum

  clone(): DrawingEdge {
    const ret = new DrawingEdge(null)
    DrawingObject.copyValidFields(this, ret)
    ret.directed = this.directed
    ret.arrowtail = this.arrowtail
    ret.arrowhead = this.arrowhead
    return ret
  }
}
