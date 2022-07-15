import {IViewerObject} from './iViewerObject'
import {Edge} from '../../structs/edge'
import {IViewerNode} from './iViewerNode'

export interface IViewerEdge extends IViewerObject {
  edge: Edge

  /*event*/ IsCollapsedChanged: (node: IViewerNode) => void
}
