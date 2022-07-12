import {Entity} from '../../structs/entity'

export interface IViewerObject {
  /**  the corresponding Entity*/
  entity: Entity

  /** is set to true when the object is selected for editing */
  MarkedForDragging: boolean

  /**  raised when the entity is marked for dragging */
  MarkedForDraggingEvent: (sender: any, eventParameters: any) => void

  /**  raised when the entity is unmarked for dragging*/
  UnmarkedForDraggingEvent: (sender: any, eventParameters: any) => void
}
