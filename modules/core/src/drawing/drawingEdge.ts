import {ArrowTypeEnum} from './arrowTypeEnum'
import {DrawingObject} from './drawingObject'

export class DrawingEdge extends DrawingObject {
  directed = true
  arrowtail: ArrowTypeEnum
  arrowhead: ArrowTypeEnum
}
