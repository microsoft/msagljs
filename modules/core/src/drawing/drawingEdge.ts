import {ArrowTypeEnum} from './arrowTypeEnum'
import {DrawingLabel} from './drawingLabel'
import {DrawingObject} from './drawingObject'

export class DrawingEdge extends DrawingObject {
  label: DrawingLabel
  directed = true
  arrowtail: ArrowTypeEnum
  arrowhead: ArrowTypeEnum
}
