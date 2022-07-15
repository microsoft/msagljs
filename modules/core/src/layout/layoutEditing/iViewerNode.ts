import {IViewerObject} from './iViewerObject'
import {Node} from '../../structs/node'
export interface IViewerNode extends IViewerObject {
  Node: Node

  /*event*/ IsCollapsedChanged: (node: IViewerNode) => void
}
