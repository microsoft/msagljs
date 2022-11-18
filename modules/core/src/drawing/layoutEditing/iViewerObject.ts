import {DrawingObject} from '../../drawing/drawingObject'
import {Entity} from '../../structs/entity'

export interface IViewerObject {
  /**  the corresponding Entity*/
  entity: Entity

  isVisible: boolean

  /** is set to true when the object is selected for editing */
  markedForDragging: boolean

  /**  called when the entity is unmarked for dragging*/
  unmarkedForDraggingCallback: () => void
}
export function getViewerDrawingObject(ivo: IViewerObject): DrawingObject {
  return DrawingObject.getDrawingObj(ivo.entity)
}
