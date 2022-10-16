import {IViewerObject} from './iViewerObject'
import {Edge} from '../../structs/edge'
import {IViewerNode} from './iViewerNode'

export interface IViewerEdge extends IViewerObject {
  selectedForEditing: boolean
  edge: Edge
  IsCollapsedChanged: (node: IViewerNode) => void
  radiusOfPolylineCorner: number
}
