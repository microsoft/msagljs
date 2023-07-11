import {IViewerObject} from './iViewerObject'
import {IViewerNode} from './iViewerNode'
import {Edge} from '@msagl/core'

export interface IViewerEdge extends IViewerObject {
  selectedForEditing: boolean
  edge: Edge
  IsCollapsedChanged: (node: IViewerNode) => void
  radiusOfPolylineCorner: number
}
